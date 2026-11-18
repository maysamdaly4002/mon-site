import { useState } from 'react';
import { Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import {
  Button, EmptyState, ErrorState, PageHeader, Table, Td, Th,
  errorMessage, toast, useAsync, useConfirm, type AdminPageProps,
} from '@snapify/sdk/admin';
import type { Campaign, Settings } from '../types';
import { FilterTabs, RowMenu, SearchBox, StatusPill, TableCard, type Tone } from './ui';
import { CampaignEditor, TEMPLATES, type Draft } from './CampaignEditor';

type Row = Campaign & { id: string; sent: number; failed: number };

const STATUS: Record<Campaign['status'], string> = {
  draft: 'Brouillon',
  sending: 'Envoi en cours',
  sent: 'Envoyée',
};

const TONE: Record<Campaign['status'], Tone> = { draft: 'slate', sending: 'amber', sent: 'green' };
type Tab = 'all' | Campaign['status'];

function formatDate(iso: string | undefined | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function CampaignsPage({ api }: AdminPageProps<Settings>) {
  const confirm = useConfirm();
  const list = useAsync(() => api.get<{ campaigns: Row[] }>('/campaigns'), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ id: string; sent: number; failed: number; remaining: number | null } | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const rows = list.data?.campaigns ?? [];
  const count = (s: Campaign['status']) => rows.filter((c) => c.status === s).length;
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (c) => (tab === 'all' || c.status === tab) && (!q || (c.subject || '').toLowerCase().includes(q)),
  );

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.id) await api.put(`/campaigns/${draft.id}`, draft);
      else await api.post('/campaigns', draft);
      toast.success('Campagne enregistrée');
      setDraft(null);
      void list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!draft?.id) return toast.error('Enregistrez la campagne avant d’envoyer un test.');
    try {
      await api.post(`/campaigns/${draft.id}/test`, { email: testEmail });
      toast.success(`E-mail de test envoyé à ${testEmail}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (c: Row) => {
    if (!(await confirm({ title: `Supprimer « ${c.subject} » ?`, message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/campaigns/${c.id}`);
      toast.success('Campagne supprimée');
      void list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  /** Rappelle la route d’envoi lot après lot jusqu’à ce qu’il ne reste plus personne. */
  const launch = async (c: Row) => {
    if (!(await confirm({ title: `Envoyer « ${c.subject} » ?`, message: 'La campagne part à tous les abonnés actifs. Cette action est définitive.', confirmLabel: 'Envoyer' }))) return;
    let sent = 0, failed = 0;
    setProgress({ id: c.id, sent, failed, remaining: null });
    try {
      for (;;) {
        const r = await api.post<{ sent: number; failed: number; remaining: number }>(`/campaigns/${c.id}/send`, {});
        sent += r.sent;
        failed += r.failed;
        setProgress({ id: c.id, sent, failed, remaining: r.remaining });
        if (r.remaining === 0 || r.sent + r.failed === 0) break;
      }
      toast.success(`Envoi terminé : ${sent} envoyé(s), ${failed} échec(s)`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProgress(null);
      void list.reload();
    }
  };

  return (
    <div>
      <PageHeader
        title="Campagnes"
        description="Rédigez un e-mail, testez-le, puis envoyez-le à vos abonnés actifs."
        actions={
          <Button icon={Plus} onClick={() => setDraft({ subject: '', htmlBody: TEMPLATES[0].html })}>
            Nouvelle campagne
          </Button>
        }
      />

      {list.error ? <ErrorState message={errorMessage(list.error)} onRetry={() => void list.reload()} /> : null}
      {!list.error && !list.loading && rows.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Aucune campagne"
          description="Créez votre première campagne, puis envoyez-vous un e-mail de test."
        />
      ) : null}

      {rows.length > 0 ? (
        <TableCard
          toolbar={
            <>
              <FilterTabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'all', label: 'Toutes', count: rows.length },
                  { id: 'draft', label: 'Brouillons', count: count('draft') },
                  { id: 'sending', label: 'En cours', count: count('sending') },
                  { id: 'sent', label: 'Envoyées', count: count('sent') },
                ]}
              />
              <SearchBox value={query} onChange={setQuery} placeholder="Rechercher une campagne…" />
            </>
          }
        >
          <Table>
            <thead>
              <tr>
                <Th>Objet</Th>
                <Th>Statut</Th>
                <Th>Envoyés</Th>
                <Th>Échecs</Th>
                <Th>Créée</Th>
                <Th>Envoyée</Th>
                <Th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <div className="font-medium text-slate-900">{c.subject || '—'}</div>
                  </Td>
                  <Td>
                    {progress?.id === c.id ? (
                      <StatusPill tone="amber">En cours… reste {progress.remaining ?? '?'}</StatusPill>
                    ) : (
                      <StatusPill tone={TONE[c.status]}>{STATUS[c.status]}</StatusPill>
                    )}
                  </Td>
                  <Td>{c.sent}</Td>
                  <Td>{c.failed > 0 ? <span className="font-medium text-red-600">{c.failed}</span> : c.failed}</Td>
                  <Td className="text-sm text-slate-600">{formatDate(c.createdAt)}</Td>
                  <Td className="text-sm text-slate-600">{formatDate(c.sentAt)}</Td>
                  <Td className="text-right">
                    <RowMenu
                      items={[
                        {
                          label: 'Modifier',
                          icon: Pencil,
                          hidden: c.status === 'sent',
                          onClick: () => setDraft({ id: c.id, subject: c.subject, htmlBody: c.htmlBody }),
                        },
                        {
                          label: 'Envoyer',
                          icon: Send,
                          hidden: c.status === 'sent' || progress?.id === c.id,
                          onClick: () => void launch(c),
                        },
                        { label: 'Supprimer', icon: Trash2, danger: true, onClick: () => void remove(c) },
                      ]}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Aucune campagne ne correspond à ce filtre.</p>
          ) : null}
        </TableCard>
      ) : null}

      {draft ? (
        <CampaignEditor
          draft={draft}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          saving={saving}
          testEmail={testEmail}
          setTestEmail={setTestEmail}
          onSave={() => void save()}
          onSendTest={() => void sendTest()}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </div>
  );
}
