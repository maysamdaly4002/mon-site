/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpCircle, CheckCircle2, Download, Eye, FlaskConical, LayoutTemplate, Paintbrush, PackageSearch, RefreshCw, Search, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { InstalledThemeInfo, MarketplaceListing, StagedPackageInfo } from '../../../server/modules/types';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { api } from '../lib/api';
import { errorMessage, useAsync } from '../lib/hooks';
import { fmtBytes } from '../lib/format';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, PageSkeleton, Tabs } from '../ui/primitives';
import { useConfirm } from '../ui/overlays';
import { ImportPackageButton, InstallDialog } from '../modules/InstallDialog';
import { ModuleStatusBadge, PRICING_LABEL } from '../modules/labels';

type Tab = 'installed' | 'add';
type CatalogTheme = MarketplaceListing['modules'][number];

function Screenshot({ src, name, children }: { src?: string; name: string; children?: ReactNode }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl border-b border-slate-200 bg-slate-100">
      {src ? (
        <img src={src} alt={`Aperçu du thème ${name}`} loading="lazy" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-300">
          <LayoutTemplate className="h-12 w-12" />
        </div>
      )}
      {children}
    </div>
  );
}

function SignatureNote({ signed }: { signed: boolean }) {
  return signed ? (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <ShieldCheck className="h-3.5 w-3.5" /> Signé NOVALABS
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-amber-700">
      <FlaskConical className="h-3.5 w-3.5" /> Non signé
    </span>
  );
}

function InstalledCard({ t, isSuper, busy, onActivate, onDelete }: { t: InstalledThemeInfo; isSuper: boolean; busy: boolean; onActivate: () => void; onDelete: () => void }) {
  const blocked = t.status.code !== 'active' && t.status.code !== 'disabled';
  return (
    <Card padded={false} className={t.active ? 'ring-2 ring-brand-500' : undefined}>
      <Screenshot src={t.screenshot} name={t.name}>
        {t.active ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
            <CheckCircle2 className="h-3.5 w-3.5" /> Thème actif
          </span>
        ) : null}
      </Screenshot>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-900">{t.name}</p>
            <p className="text-xs text-slate-500">
              v{t.version} · {t.author.name}
            </p>
          </div>
          {blocked ? <ModuleStatusBadge code={t.status.code} /> : <Badge tone={t.pricing === 'free' ? 'success' : 'brand'}>{PRICING_LABEL[t.pricing]}</Badge>}
        </div>
        <p className="line-clamp-2 text-sm text-slate-600">{t.description}</p>
        {blocked ? (
          <p className="flex items-start gap-1.5 text-xs text-rose-700">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t.status.message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {t.active ? (
            <Link to={`/themes/customize?theme=${encodeURIComponent(t.id)}`}>
              <Button size="sm" variant="primary" icon={Paintbrush}>
                Personnaliser
              </Button>
            </Link>
          ) : (
            <>
              <Link to={`/themes/customize?theme=${encodeURIComponent(t.id)}`}>
                <Button size="sm" icon={Eye} disabled={blocked}>
                  Aperçu
                </Button>
              </Link>
              {isSuper ? (
                <Button size="sm" variant="primary" loading={busy} disabled={blocked} onClick={onActivate}>
                  Activer
                </Button>
              ) : null}
              {isSuper ? (
                <Button size="sm" variant="ghost" icon={Trash2} className="ml-auto text-rose-600 hover:bg-rose-50" onClick={onDelete}>
                  <span className="sr-only">Supprimer</span>
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function CatalogCard({ t, busy, canInstall, onInstall }: { t: CatalogTheme; busy: boolean; canInstall: boolean; onInstall: () => void }) {
  const installed = t.installedVersion !== null;
  return (
    <Card padded={false} className="flex flex-col">
      <Screenshot src={t.screenshot} name={t.name} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-900">{t.name}</p>
            <p className="text-xs text-slate-500">
              v{t.version} · {t.author.name}
            </p>
          </div>
          <Badge tone={t.pricing === 'free' ? 'success' : 'brand'}>{PRICING_LABEL[t.pricing]}</Badge>
        </div>
        <p className="mt-2 flex-1 text-sm text-slate-600">{t.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {t.category ? <Badge tone="neutral">{t.category}</Badge> : null}
          <SignatureNote signed={t.signed} />
          <span>· {fmtBytes(t.size)}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {installed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Installé (v{t.installedVersion})
            </span>
          ) : !t.compatible ? (
            <span className="text-xs text-rose-700">Requiert Snapify {t.engines.snapify}</span>
          ) : (
            <span />
          )}
          {canInstall && (t.updateAvailable || !installed) ? (
            <Button size="sm" variant="primary" icon={t.updateAvailable ? ArrowUpCircle : Download} loading={busy} disabled={!t.compatible} onClick={onInstall}>
              {t.updateAvailable ? 'Mettre à jour' : 'Installer'}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function ThemesPage() {
  const { can } = useAuth();
  const { reload: reloadSite } = useSite();
  const isSuper = can('appearance.themes');
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('installed');
  const installed = useAsync(() => api.themes.list(), []);
  const [refresh, setRefresh] = useState(0);
  const catalog = useAsync(() => (tab === 'add' ? api.modules.marketplace(refresh > 0) : Promise.resolve(null)), [tab, refresh]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedPackageInfo | null>(null);

  const themes = installed.data?.themes ?? [];
  const catalogThemes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (catalog.data?.modules ?? []).filter((m) => m.kind === 'theme');
    return q ? list.filter((m) => `${m.name} ${m.description} ${m.category ?? ''} ${m.author.name}`.toLowerCase().includes(q)) : list;
  }, [catalog.data, query]);

  const activate = async (t: InstalledThemeInfo) => {
    setBusy(t.id);
    try {
      await api.themes.activate(t.id);
      toast.success(`${t.name} est maintenant le thème du site`);
      installed.reload();
      void reloadSite();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (t: InstalledThemeInfo) => {
    const ok = await confirm({
      title: `Supprimer « ${t.name} » ?`,
      message: 'Le thème et ses options seront supprimés. Le contenu du site n’est pas touché. Vous pourrez le réinstaller depuis la marketplace.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.themes.uninstall(t.id);
      toast.success(`${t.name} supprimé`);
      installed.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const stage = async (id: string) => {
    setBusy(id);
    try {
      setStaged(await api.modules.stage(id));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const afterInstall = () => {
    installed.reload();
    catalog.reload();
    setTab('installed');
  };

  if (installed.loading && !installed.data) return <PageSkeleton />;
  if (installed.error && !installed.data) return <ErrorState message={installed.error} onRetry={installed.reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thèmes"
        description="Le thème définit l’apparence du site : en-tête, pied de page, mise en forme des blocs. Le contenu reste le même quel que soit le thème."
        actions={isSuper ? <ImportPackageButton kind="theme" onInstalled={afterInstall} /> : null}
      />

      {installed.data?.devMode ? (
        <Alert tone="warning" icon={FlaskConical} title="Mode développeur actif">
          Les thèmes non signés peuvent être installés. Désactivez <code>SNAPIFY_MODULES_DEV_MODE</code> en production.
        </Alert>
      ) : null}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'installed', label: 'Installés', badge: <Badge tone="neutral">{themes.length}</Badge> },
          ...(isSuper ? [{ value: 'add' as const, label: 'Ajouter un thème', icon: Download }] : []),
        ]}
      />

      {tab === 'installed' ? (
        themes.length === 0 ? (
          <EmptyState icon={LayoutTemplate} title="Aucun thème installé" description="Installez un thème depuis l’onglet « Ajouter un thème »." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {themes.map((t) => (
              <InstalledCard key={t.id} t={t} isSuper={isSuper} busy={busy === t.id} onActivate={() => void activate(t)} onDelete={() => void remove(t)} />
            ))}
          </div>
        )
      ) : !catalog.data && !catalog.error ? (
        <PageSkeleton />
      ) : catalog.error && !catalog.data ? (
        <ErrorState message={catalog.error} onRetry={catalog.reload} />
      ) : (
        <div className="space-y-5">
          {catalog.data?.error ? (
            <Alert tone="warning" title="Catalogue distant indisponible">
              {catalog.data.error} Le catalogue local est affiché à la place.
            </Alert>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un thème" className="pl-9" />
            </div>
            <Button icon={RefreshCw} loading={catalog.loading} onClick={() => setRefresh((n) => n + 1)}>
              Actualiser
            </Button>
          </div>
          {catalogThemes.length === 0 ? (
            <EmptyState icon={PackageSearch} title="Aucun thème trouvé" description={query ? 'Essayez un autre mot-clé.' : 'Le catalogue ne propose pas encore de thème.'} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {catalogThemes.map((t) => (
                <CatalogCard key={t.id} t={t} busy={busy === t.id} canInstall={isSuper} onInstall={() => void stage(t.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      <InstallDialog staged={staged} onClose={() => setStaged(null)} onInstalled={afterInstall} />
    </div>
  );
}
