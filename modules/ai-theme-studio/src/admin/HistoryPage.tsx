import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Alert, Button, Card, EmptyState, PageHeader, errorMessage, toast, type AdminPageProps } from '@snapify/sdk/admin';
import type { GenerationRecord, Settings } from '../types';

export function HistoryPage({ api }: AdminPageProps<Settings>) {
  const [rows, setRows] = useState<GenerationRecord[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const r = await api.get<{ generations: GenerationRecord[] }>('/generations');
      setRows(r.generations || []);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (id: string) => {
    try {
      await api.delete(`/generations/${id}`);
      setRows((xs) => xs.filter((x) => x.id !== id));
      toast.message('Supprimé');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Générations"
        description="Historique des thèmes proposés par l’IA."
        actions={
          <Button variant="ghost" loading={busy} onClick={() => void load()}>
            Actualiser
          </Button>
        }
      />
      {!rows.length ? (
        <EmptyState icon={History} title="Aucune génération" description="Lancez une création depuis Atelier thème IA." />
      ) : (
        <div className="space-y-3">
          {rows.map((g) => (
            <Card key={g.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {g.spec?.siteName || (g.status === 'pending' ? 'Génération en cours…' : 'Sans nom')}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{g.prompt}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(g.createdAt).toLocaleString('fr-FR')} · {g.provider} · {g.model || '—'} · {g.status}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void remove(g.id)}>
                  Supprimer
                </Button>
              </div>
              {g.status === 'pending' ? (
                <Alert tone="info" title="En cours">
                  <p className="text-sm">L’IA prépare encore cette proposition — actualisez dans un instant.</p>
                </Alert>
              ) : null}
              {g.status === 'failed' && g.error ? (
                <Alert tone="danger" title="Échec">
                  <p className="text-sm">{g.error}</p>
                </Alert>
              ) : null}
              {g.applied ? (
                <p className="text-xs font-medium text-emerald-700">
                  Appliqué {new Date(g.applied.at).toLocaleString('fr-FR')}
                  {g.applied.branding ? ' · identité' : ''}
                  {g.applied.theme ? ' · thème' : ''}
                  {g.applied.home ? ' · accueil' : ''}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
