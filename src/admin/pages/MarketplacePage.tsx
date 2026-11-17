/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpCircle,
  CheckCircle2,
  CreditCard,
  Download,
  FlaskConical,
  Images,
  LayoutTemplate,
  Package,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MarketplaceListing, StagedPackageInfo } from '../../../server/modules/types';
import { api } from '../lib/api';
import { errorMessage, useAsync } from '../lib/hooks';
import { fmtBytes } from '../lib/format';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, PageSkeleton, Tabs } from '../ui/primitives';
import { ImportPackageButton, InstallDialog } from '../modules/InstallDialog';
import { ModuleIcon, PRICING_LABEL } from '../modules/labels';

type Listing = MarketplaceListing['modules'][number];
type KindFilter = 'all' | 'module' | 'theme';

function listingKind(m: Listing): 'module' | 'theme' {
  return m.kind === 'theme' ? 'theme' : 'module';
}

function Screenshot({ src, name, logo, kind, children }: { src?: string; name: string; logo?: string; kind: 'module' | 'theme'; children?: ReactNode }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl border-b border-slate-200 bg-slate-100">
      {src ? (
        <img src={src} alt={`Aperçu ${kind === 'theme' ? 'du thème' : 'du module'} ${name}`} loading="lazy" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300">
          {kind === 'theme' ? <LayoutTemplate className="h-14 w-14" /> : <ModuleIcon name={logo} className="h-14 w-14 ring-0" />}
        </div>
      )}
      <div className="absolute bottom-3 left-3">
        {kind === 'theme' ? (
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-md ring-2 ring-white text-slate-500">
            <LayoutTemplate className="h-5 w-5" />
          </span>
        ) : (
          <ModuleIcon name={logo} className="h-10 w-10 shadow-md ring-2 ring-white" />
        )}
      </div>
      {children}
    </div>
  );
}

function GalleryModal({
  open,
  name,
  images,
  onClose,
}: {
  open: boolean;
  name: string;
  images: string[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (open) setIdx(0);
  }, [open, images]);
  if (!open || !images.length) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4" role="dialog" aria-modal onClick={onClose}>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="truncate text-sm font-semibold text-slate-900">{name} — aperçus</p>
          <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <img src={images[idx]} alt={`${name} capture ${idx + 1}`} className="max-h-[70vh] w-full object-contain bg-slate-50" />
        {images.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 p-3">
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${i === idx ? 'border-brand-500' : 'border-transparent'}`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModuleCard({
  m,
  busy,
  onInstall,
  onBuy,
  onGallery,
}: {
  m: Listing;
  busy: boolean;
  onInstall: () => void;
  onBuy: () => void;
  onGallery: () => void;
}) {
  const installed = m.installedVersion !== null;
  const paid = m.pricing === 'paid';
  const needsPurchase = paid && !m.purchased && !installed;
  const gallery = m.gallery?.length ? m.gallery : m.screenshot ? [m.screenshot] : [];
  const kind = listingKind(m);

  return (
    <Card padded={false} className="flex flex-col overflow-hidden">
      <Screenshot src={m.screenshot} name={m.name} logo={m.icon} kind={kind}>
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
          {kind === 'theme' ? 'Thème' : 'Module'}
        </span>
        {installed ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
            <CheckCircle2 className="h-3.5 w-3.5" /> Installé
          </span>
        ) : needsPurchase ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
            {m.priceLabel || PRICING_LABEL.paid}
          </span>
        ) : paid && m.purchased ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2.5 py-1 text-xs font-semibold text-white shadow">
            Acheté
          </span>
        ) : (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow">
            Gratuit
          </span>
        )}
      </Screenshot>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-900">{m.name}</p>
            <p className="text-xs text-slate-500">
              v{m.version} · {m.author.name}
            </p>
          </div>
          <Badge tone={paid ? 'brand' : 'success'}>{paid ? m.priceLabel || PRICING_LABEL.paid : PRICING_LABEL.free}</Badge>
        </div>

        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">{m.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <Badge tone="neutral">{m.category}</Badge>
          {m.signed ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Signé
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <FlaskConical className="h-3.5 w-3.5" /> Non signé
            </span>
          )}
          <span>· {fmtBytes(m.size)}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {gallery.length ? (
            <Button size="sm" variant="ghost" icon={Images} onClick={onGallery}>
              Captures
            </Button>
          ) : null}

          {installed ? (
            <Link to={kind === 'theme' ? '/themes' : `/modules/${m.id}`} className="ml-auto">
              <Button size="sm">Gérer</Button>
            </Link>
          ) : null}

          {m.updateAvailable ? (
            <Button size="sm" variant="primary" icon={ArrowUpCircle} loading={busy} disabled={!m.compatible} onClick={onInstall} className={installed ? undefined : 'ml-auto'}>
              Mettre à jour
            </Button>
          ) : null}

          {!installed && needsPurchase ? (
            <Button size="sm" variant="primary" icon={CreditCard} loading={busy} disabled={!m.compatible} onClick={onBuy} className="ml-auto">
              Acheter {m.priceLabel ? `· ${m.priceLabel}` : ''}
            </Button>
          ) : null}

          {!installed && !needsPurchase && !m.updateAvailable ? (
            <Button size="sm" variant="primary" icon={Download} loading={busy} disabled={!m.compatible} onClick={onInstall} className="ml-auto">
              {paid && m.purchased ? 'Installer (licence OK)' : 'Installer'}
            </Button>
          ) : null}

          {!m.compatible && !installed ? <span className="w-full text-xs text-rose-700">Requiert Snapify {m.engines.snapify}</span> : null}
        </div>
      </div>
    </Card>
  );
}

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [refresh, setRefresh] = useState(0);
  const { data, error, loading, reload } = useAsync(() => api.modules.marketplace(refresh > 0), [refresh]);
  const [query, setQuery] = useState('');
  const kindParam = params.get('kind');
  const kindFilter: KindFilter = kindParam === 'module' || kindParam === 'theme' ? kindParam : 'all';
  const [busyId, setBusyId] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedPackageInfo | null>(null);
  const [gallery, setGallery] = useState<{ name: string; images: string[] } | null>(null);
  const purchaseHandled = useRef<string | null>(null);

  const setKindFilter = (k: KindFilter) => {
    const next = new URLSearchParams(params);
    if (k === 'all') next.delete('kind');
    else next.set('kind', k);
    setParams(next, { replace: true });
  };

  const listings = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data?.modules ?? [];
    if (kindFilter === 'module') list = list.filter((m) => listingKind(m) === 'module');
    if (kindFilter === 'theme') list = list.filter((m) => listingKind(m) === 'theme');
    return q ? list.filter((m) => `${m.name} ${m.description} ${m.category} ${m.author.name}`.toLowerCase().includes(q)) : list;
  }, [data, query, kindFilter]);

  const counts = useMemo(() => {
    const all = data?.modules ?? [];
    return {
      all: all.length,
      module: all.filter((m) => listingKind(m) === 'module').length,
      theme: all.filter((m) => listingKind(m) === 'theme').length,
    };
  }, [data]);

  const stage = async (id: string) => {
    setBusyId(id);
    try {
      setStaged(await api.modules.stage(id));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const buy = async (id: string) => {
    setBusyId(id);
    try {
      const checkout = await api.modules.checkout(id);
      toast.message(`Paiement ${checkout.amountLabel} — redirection Flouci…`);
      window.location.href = checkout.paymentLink;
    } catch (e) {
      toast.error(errorMessage(e));
      setBusyId(null);
    }
  };

  /** Retour Flouci : finalise l’achat, stage le module, ouvre l’install. */
  useEffect(() => {
    const status = params.get('purchase');
    const pid = params.get('pid');
    if (status === 'fail') {
      toast.error('Paiement annulé ou échoué');
      setParams({}, { replace: true });
      return;
    }
    if (status !== 'ok' || !pid || purchaseHandled.current === pid) return;
    purchaseHandled.current = pid;

    let cancelled = false;
    (async () => {
      toast.message('Vérification du paiement…');
      try {
        let purchase: Awaited<ReturnType<typeof api.modules.purchase>>['purchase'] | null = null;
        for (let i = 0; i < 12 && !cancelled; i++) {
          const res = await api.modules.purchase(pid);
          purchase = res.purchase;
          if (purchase.status === 'paid' && purchase.licenseKey) break;
          await new Promise((r) => setTimeout(r, 800));
        }
        if (cancelled) return;
        if (!purchase || purchase.status !== 'paid') {
          toast.error('Paiement non confirmé. Réessayez dans quelques secondes ou contactez le support.');
          setParams({}, { replace: true });
          return;
        }
        toast.success(`« ${purchase.moduleName} » acheté — installation…`);
        setBusyId(purchase.moduleId);
        const stagedPkg = await api.modules.stage(purchase.moduleId);
        setStaged(stagedPkg);
        reload();
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusyId(null);
        setParams({}, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, setParams, reload]);

  const afterInstall = (m: { id: string; kind: string }) => {
    reload();
    navigate(m.kind === 'theme' ? '/themes' : `/modules/${m.id}`);
  };

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const emptyTitle =
    kindFilter === 'theme' ? 'Aucun thème trouvé' : kindFilter === 'module' ? 'Aucun module trouvé' : 'Aucun produit trouvé';
  const emptyDesc = query
    ? 'Essayez un autre mot-clé.'
    : kindFilter === 'theme'
      ? 'Le catalogue ne propose pas encore de thème.'
      : kindFilter === 'module'
        ? 'Le catalogue ne propose pas encore de module.'
        : 'Le catalogue est vide pour le moment.';
  const searchPlaceholder =
    kindFilter === 'theme' ? 'Rechercher un thème' : kindFilter === 'module' ? 'Rechercher un module' : 'Rechercher un module ou un thème';
  const countLabel =
    kindFilter === 'theme'
      ? `${listings.length} thème${listings.length > 1 ? 's' : ''}`
      : kindFilter === 'module'
        ? `${listings.length} module${listings.length > 1 ? 's' : ''}`
        : `${listings.length} produit${listings.length > 1 ? 's' : ''}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Modules et thèmes officiels avec aperçu. Les produits payants s’achètent ici par carte (Flouci) — la licence est appliquée automatiquement à l’installation."
        actions={
          <>
            <Button icon={RefreshCw} loading={loading} onClick={() => setRefresh((n) => n + 1)}>
              Actualiser
            </Button>
            <ImportPackageButton onInstalled={afterInstall} />
          </>
        }
      />

      {data.devMode ? (
        <Alert tone="warning" icon={FlaskConical} title="Mode développeur actif">
          Les paquets non signés (modules et thèmes) peuvent être installés. Désactivez <code>SNAPIFY_MODULES_DEV_MODE</code> en production.
        </Alert>
      ) : null}
      {data.error ? (
        <Alert tone="warning" title="Catalogue distant indisponible">
          {data.error} Le catalogue local est affiché à la place.
        </Alert>
      ) : null}

      <Tabs<KindFilter>
        value={kindFilter}
        onChange={setKindFilter}
        tabs={[
          { value: 'all', label: 'Tout', badge: <Badge tone="neutral">{counts.all}</Badge> },
          { value: 'module', label: 'Modules', icon: Package, badge: <Badge tone="neutral">{counts.module}</Badge> },
          { value: 'theme', label: 'Thèmes', icon: LayoutTemplate, badge: <Badge tone="neutral">{counts.theme}</Badge> },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="pl-9" />
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Store className="h-3.5 w-3.5" />
          {data.source === 'remote' ? `Catalogue : ${data.url}` : 'Catalogue local'} · {countLabel}
        </p>
      </div>

      {listings.length === 0 ? (
        <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyDesc} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {listings.map((m) => (
            <ModuleCard
              key={m.id}
              m={m}
              busy={busyId === m.id}
              onInstall={() => void stage(m.id)}
              onBuy={() => void buy(m.id)}
              onGallery={() =>
                setGallery({
                  name: m.name,
                  images: m.gallery?.length ? m.gallery : m.screenshot ? [m.screenshot] : [],
                })
              }
            />
          ))}
        </div>
      )}

      <InstallDialog staged={staged} onClose={() => setStaged(null)} onInstalled={afterInstall} />
      <GalleryModal open={!!gallery} name={gallery?.name || ''} images={gallery?.images || []} onClose={() => setGallery(null)} />
    </div>
  );
}
