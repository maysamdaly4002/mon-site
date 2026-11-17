import { Clock, MousePointerClick, RotateCcw } from 'lucide-react';
import {
  Button,
  Card,
  defineAdminModule,
  ErrorState,
  fmtDateTime,
  PageHeader,
  PageSkeleton,
  StatCard,
  toast,
  useAsync,
  useConfirm,
  type AdminPageProps,
} from '@snapify/sdk/admin';
import type { Settings, Stats } from './types';

function StatsPage({ api, settings }: AdminPageProps<Settings>) {
  const { data, loading, error, reload } = useAsync(() => api.get<Stats>('/stats'), [api]);
  const confirm = useConfirm();

  const reset = async () => {
    const ok = await confirm({ title: 'Remettre le compteur à zéro ?', message: 'Les clics enregistrés seront effacés.', confirmLabel: 'Remettre à zéro', danger: true });
    if (!ok) return;
    await api.post('/reset');
    toast.success('Compteur remis à zéro');
    await reload();
  };

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistiques"
        description={`Clics sur la bannière « ${settings.message} ».`}
        actions={
          <Button icon={RotateCcw} onClick={reset}>
            Remettre à zéro
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Clics" value={data?.clicks ?? 0} icon={MousePointerClick} />
        <StatCard label="Dernier clic" value={data?.lastClickAt ? fmtDateTime(data.lastClickAt) : '—'} icon={Clock} tone="sky" />
      </div>
      <Card className="text-sm text-slate-600">Le message, l’affichage et les pages de la bannière se règlent dans la fiche du module.</Card>
    </div>
  );
}

export default defineAdminModule<Settings>({ pages: { statistiques: StatsPage } });
