import { useEffect, useState } from 'react';
import { Button, Card, EmptyState, PageHeader, PageSkeleton, errorMessage, toast, type AdminPageProps } from '@snapify/sdk/admin';
import type { MigrationJob, Settings } from '../types';

export function HistoryPage({ api, navigate }: AdminPageProps<Settings>) {
  const [items, setItems] = useState<MigrationJob[] | null>(null);

  useEffect(() => {
    void api
      .get<{ items: MigrationJob[] }>('/jobs')
      .then((r) => setItems(r.items))
      .catch((e) => toast.error(errorMessage(e)));
  }, [api]);

  if (!items) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique des migrations"
        description="Reprenez une migration ou téléchargez un rapport."
        actions={
          <Button onClick={() => navigate('/m/hamdiayari.wp-seo-migrator/wizard', { absolute: true })}>
            Nouvelle migration
          </Button>
        }
      />
      {!items.length ? (
        <EmptyState title="Aucune migration" description="Lancez l’assistant pour analyser un export WordPress." />
      ) : (
        <div className="space-y-3">
          {items.map((j) => (
            <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">{j.siteUrl}</div>
                <div className="text-sm text-slate-500">
                  {j.status} · {j.stats.coveragePct} % · {new Date(j.createdAt).toLocaleString('fr-TN')}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const r = await api.get<{ filename: string; csv: string }>(`/jobs/${j.id}/report`);
                    const blob = new Blob([r.csv], { type: 'text/csv' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = r.filename;
                    a.click();
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                Rapport CSV
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
