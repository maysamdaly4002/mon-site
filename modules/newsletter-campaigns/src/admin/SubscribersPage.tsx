import { useState } from 'react';
import { Download, Trash2, Upload, Users } from 'lucide-react';
import {
  Button, EmptyState, ErrorState, Field, Modal, PageHeader, Table, Td, Textarea, Th,
  errorMessage, toast, useAsync, useConfirm, type AdminPageProps,
} from '@snapify/sdk/admin';
import type { Settings, Subscriber } from '../types';
import { FilterTabs, RowMenu, SearchBox, StatusPill, TableCard, type Tone } from './ui';

type Row = Omit<Subscriber, 'confirmToken' | 'unsubToken'> & { id: string };
const STATUS: Record<Subscriber['status'], string> = {
  pending: 'En attente',
  active: 'Actif',
  unsubscribed: 'Désinscrit',
  bounced: 'Échec (bounce)',
};

const TONE: Record<Subscriber['status'], Tone> = { pending: 'amber', active: 'green', unsubscribed: 'slate', bounced: 'red' };
type Tab = 'all' | Subscriber['status'];

const CSV_COLUMNS: (keyof Row)[] = ['email', 'firstName', 'status', 'source', 'consentAt', 'confirmedAt', 'unsubscribedAt', 'failCount'];

function toCsv(rows: Row[]) {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [CSV_COLUMNS.join(','), ...rows.map((r) => CSV_COLUMNS.map((k) => escape(r[k])).join(','))];
  return lines.join('\r\n');
}

export function SubscribersPage({ api }: AdminPageProps<Settings>) {
  const confirm = useConfirm();
  const list = useAsync(() => api.get<{ subscribers: Row[]; total: number }>('/subscribers'), []);
  const [importing, setImporting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const rows = list.data?.subscribers ?? [];
  const count = (st: Subscriber['status']) => rows.filter((r) => r.status === st).length;
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (tab === 'all' || r.status === tab) &&
      (!q || r.email.toLowerCase().includes(q) || (r.firstName || '').toLowerCase().includes(q)),
  );

  const runImport = async () => {
    if (importing === null) return;
    setBusy(true);
    try {
      const r = await api.post<{ added: number; skipped: number; invalid: number }>('/subscribers/import', { text: importing });
      toast.success(`${r.added} ajouté(s), ${r.skipped} déjà présent(s), ${r.invalid} ligne(s) ignorée(s)`);
      setImporting(null);
      void list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Row) => {
    if (!(await confirm({ title: `Supprimer ${s.email} ?`, message: 'L\'abonné sera effacé définitivement.', confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/subscribers/${s.id}`);
      void list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abonnes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Abonnés"
        description="Liste des abonnés de ce module. Importez ici l'export CSV de la page Newsletter du site."
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" icon={Download} onClick={exportCsv} disabled={!rows.length}>
              Exporter CSV
            </Button>
            <Button icon={Upload} onClick={() => setImporting('')}>Importer</Button>
          </div>
        }
      />
      {list.error ? <ErrorState message={errorMessage(list.error)} onRetry={() => void list.reload()} /> : null}
      {!list.error && !list.loading && rows.length === 0 ? (
        <EmptyState icon={Users} title="Aucun abonné" description="Ajoutez le widget d'inscription à une page, ou importez une liste d'adresses déjà confirmées." />
      ) : null}
      {rows.length > 0 ? (
        <TableCard
          toolbar={
            <>
              <FilterTabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'all', label: 'Tous', count: rows.length },
                  { id: 'active', label: 'Actifs', count: count('active') },
                  { id: 'pending', label: 'En attente', count: count('pending') },
                  { id: 'unsubscribed', label: 'Désinscrits', count: count('unsubscribed') },
                  { id: 'bounced', label: 'Échecs', count: count('bounced') },
                ]}
              />
              <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un abonné…" />
            </>
          }
        >
          <Table>
            <thead>
              <tr>
                <Th>E-mail</Th>
                <Th>Prénom</Th>
                <Th>Statut</Th>
                <Th>Origine</Th>
                <Th>Confirmé</Th>
                <Th>Échecs</Th>
                <Th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <div className="font-medium text-slate-900">{s.email}</div>
                  </Td>
                  <Td>{s.firstName || '—'}</Td>
                  <Td>
                    <StatusPill tone={TONE[s.status]}>{STATUS[s.status]}</StatusPill>
                  </Td>
                  <Td>{s.source === 'form' ? 'Formulaire' : s.source === 'import' ? 'Import' : 'Manuel'}</Td>
                  <Td className="text-sm text-slate-600">
                    {s.confirmedAt
                      ? new Date(s.confirmedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </Td>
                  <Td>{s.failCount > 0 ? <span className="font-medium text-red-600">{s.failCount}</span> : s.failCount}</Td>
                  <Td className="text-right">
                    <RowMenu items={[{ label: 'Supprimer', icon: Trash2, danger: true, onClick: () => void remove(s) }]} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Aucun abonné ne correspond à ce filtre.</p>
          ) : null}
        </TableCard>
      ) : null}
      {importing !== null ? (
        <Modal title="Importer des abonnés" open onClose={() => setImporting(null)} size="lg">
          <Field label="Une adresse par ligne (ou collez le CSV exporté). Elles sont ajoutées comme actives : n'importez que des personnes ayant déjà confirmé leur inscription.">
            <Textarea rows={10} value={importing} onChange={({ target: { value: v } }) => setImporting(v)} />
          </Field>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImporting(null)}>Annuler</Button>
            <Button loading={busy} onClick={() => void runImport()}>Importer</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
