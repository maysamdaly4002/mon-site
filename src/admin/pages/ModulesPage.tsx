/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FlaskConical, Puzzle, Settings2, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import type { InstalledModuleInfo } from '../../../server/modules/types';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { errorMessage, useAsync } from '../lib/hooks';
import { fmtDate } from '../lib/format';
import { Alert, Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, Switch } from '../ui/primitives';
import { ImportPackageButton } from '../modules/InstallDialog';
import { ModuleIcon, ModuleStatusBadge, notifyModulesChanged } from '../modules/labels';

function ModuleRow({ m, canManage, onChange }: { m: InstalledModuleInfo; canManage: boolean; onChange: (m: InstalledModuleInfo) => void }) {
  const [busy, setBusy] = useState(false);
  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      onChange(await api.modules.setEnabled(m.id, enabled));
      notifyModulesChanged();
      toast.success(enabled ? `${m.name} activé` : `${m.name} désactivé`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ModuleIcon name={m.icon} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-slate-900">
            <Link to={`/modules/${m.id}`} className="hover:text-brand-700">
              {m.name}
            </Link>
            <span className="text-xs font-normal text-slate-400">v{m.version}</span>
            <ModuleStatusBadge code={m.status.code} />
          </p>
          <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{m.description}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {m.signature.valid ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Signature vérifiée
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <ShieldAlert className="h-3.5 w-3.5" /> {m.signature.devUnsigned ? 'Non signé (mode développeur)' : 'Signature invalide'}
              </span>
            )}
            <span>{m.license.message}</span>
            <span>Installé le {fmtDate(m.installedAt)}</span>
          </p>
          {m.status.code !== 'active' && m.status.code !== 'disabled' ? <p className="mt-1.5 text-xs text-rose-700">{m.status.message}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Switch checked={m.enabled} onChange={(v) => void toggle(v)} disabled={!canManage || busy} label={m.enabled ? 'Activé' : 'Désactivé'} />
        <Link to={`/modules/${m.id}`}>
          <Button size="sm" icon={Settings2}>
            {m.hasSettings ? 'Configurer' : 'Détails'}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function ModulesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const isSuper = can('modules.manage');
  const { data, setData, error, loading, reload } = useAsync(() => api.modules.list(), []);

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const replace = (m: InstalledModuleInfo) => setData({ ...data, modules: data.modules.map((x) => (x.id === m.id ? m : x)) });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modules installés"
        description="Activez, configurez ou retirez les modules de votre site. L’intégrité de chaque module est contrôlée à chaque démarrage du serveur."
        actions={
          isSuper ? (
            <>
              <ImportPackageButton onInstalled={(m) => navigate(`/modules/${m.id}`)} />
              <Link to="/marketplace">
                <Button variant="primary" icon={Store}>
                  Marketplace
                </Button>
              </Link>
            </>
          ) : null
        }
      />
      {data.devMode ? (
        <Alert tone="warning" icon={FlaskConical} title="Mode développeur actif">
          Les modules non signés sont acceptés. Ne laissez pas ce mode activé en production.
        </Alert>
      ) : null}
      {data.modules.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="Aucun module installé"
          description="Parcourez la marketplace pour ajouter des fonctionnalités à votre site."
          action={
            isSuper ? (
              <Link to="/marketplace">
                <Button variant="primary" icon={Store}>
                  Ouvrir la marketplace
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {data.modules.map((m) => (
            <ModuleRow key={m.id} m={m} canManage={isSuper} onChange={replace} />
          ))}
        </div>
      )}
    </div>
  );
}
