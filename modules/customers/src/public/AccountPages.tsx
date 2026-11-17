/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Heart, LayoutDashboard, LogOut, MapPin, Package, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react';
import { createModuleApi, isModuleActive, type PublicPageProps } from '@snapify/sdk';
import { COMMERCE_PATHS, formatAddress, formatMoney, MODULE_IDS, useWishlist, type OrderDetail, type OrderSummary, type ProductCard, type SavedAddress } from '@snapify/sdk/commerce';
import { Button, Container, EmptyState, GridSkeleton, Link, Notice, ProductGrid, Spinner, cn } from '@snapify/sdk/ui/commerce';
import { formatOrderDate, OrderDetailView, OrderStatusBadge } from '@snapify/sdk/ui/orders';
import { AddressForm, emptyAddress, type AddressDraft } from './AddressForm';
import { CustomerAvatar } from './Avatar';
import { ProfileSection } from './ProfileSection';
import { api, logout, patchMe, useMe } from './session';
import type { Me, Settings } from '../types';

type Props = PublicPageProps<Settings>;
type Section = 'overview' | 'commandes' | 'adresses' | 'favoris' | 'profil';

const NAV: { id: Section; label: string; icon: React.ComponentType<{ className?: string }>; path: string }[] = [
  { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard, path: COMMERCE_PATHS.account },
  { id: 'commandes', label: 'Mes commandes', icon: Package, path: COMMERCE_PATHS.accountSection('commandes') },
  { id: 'adresses', label: 'Mes adresses', icon: MapPin, path: COMMERCE_PATHS.accountSection('adresses') },
  { id: 'favoris', label: 'Mes favoris', icon: Heart, path: COMMERCE_PATHS.accountSection('favoris') },
  { id: 'profil', label: 'Mon profil', icon: UserRound, path: COMMERCE_PATHS.accountSection('profil') },
];

/** Petit chargeur générique pour les pages du compte. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    load()
      .then((data) => alive && setState({ data, error: '', loading: false }))
      .catch((e: Error) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Loading() {
  return (
    <div className="flex justify-center py-20">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function AccountShell({ section, me, navigate, children }: { section: Section; me: Me; navigate: (p: string) => void; children: React.ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  const signOut = async () => {
    setLeaving(true);
    await logout();
    navigate(COMMERCE_PATHS.login);
  };
  return (
    <Container className="py-10 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-12">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex items-center gap-3 lg:mb-6">
            <Link to={COMMERCE_PATHS.accountSection('profil')} navigate={navigate} title="Modifier mon profil" className="rounded-full">
              <CustomerAvatar person={me} className="h-12 w-12 text-base" />
            </Link>
            <div className="min-w-0">
              <p className="truncate font-heading text-base font-semibold text-px-navy">
                {me.firstName} {me.lastName}
              </p>
              <p className="truncate text-xs text-px-muted">{me.email}</p>
            </div>
          </div>
          <nav aria-label="Espace client" className="-mx-4 mt-5 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:mt-0 lg:flex-col lg:overflow-visible lg:px-0">
            {NAV.map((n) => (
              <Link
                key={n.id}
                to={n.path}
                navigate={navigate}
                aria-current={section === n.id ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
                  section === n.id ? 'bg-px-navy text-white' : 'text-px-text hover:bg-px-surface hover:text-px-navy'
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            ))}
            <button type="button" disabled={leaving} onClick={() => void signOut()} className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium text-px-text transition hover:bg-rose-50 hover:text-rose-700 lg:mt-4">
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}

function Heading({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-px-navy sm:text-3xl">{title}</h1>
        {text ? <p className="mt-1.5 text-sm text-px-muted">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

function OrdersTable({ items, navigate }: { items: OrderSummary[]; navigate: (p: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-px-border-soft bg-white">
      <ul className="divide-y divide-px-border-soft">
        {items.map((o) => (
          <li key={o.number}>
            <Link to={`${COMMERCE_PATHS.accountSection('commandes')}${encodeURIComponent(o.number)}/`} navigate={navigate} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 transition hover:bg-px-surface/60">
              <div className="min-w-[140px] flex-1">
                <p className="text-sm font-semibold text-px-navy">{o.number}</p>
                <p className="text-xs text-px-muted">
                  {formatOrderDate(o.createdAt)} · {o.itemsCount} article{o.itemsCount > 1 ? 's' : ''}
                </p>
              </div>
              <OrderStatusBadge status={o.status} />
              <span className="w-28 text-right text-sm font-semibold tabular-nums text-px-navy">{formatMoney(o.total, o.currency)}</span>
              <ChevronRight className="hidden h-4 w-4 text-px-muted sm:block" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                     */
/* ------------------------------------------------------------------ */

export function OverviewPage({ me, navigate, setMeta }: Props & { me: Me }) {
  const ids = useWishlist();
  const res = useLoad(() => api.get<{ stats: { orders: number; spent: number; lastOrderAt: string | null } | null; recent: OrderSummary[]; ordersEnabled: boolean }>('/overview'), []);
  useEffect(() => setMeta({ title: 'Mon compte' }), [setMeta]);
  const currency = res.data?.recent[0]?.currency ?? 'TND';
  const defaultAddress = me.addresses.find((a) => a.isDefault);

  const cards = [
    res.data?.ordersEnabled ? { label: 'Commandes', value: String(res.data.stats?.orders ?? 0), to: COMMERCE_PATHS.accountSection('commandes') } : null,
    res.data?.ordersEnabled ? { label: 'Total de vos achats', value: formatMoney(res.data.stats?.spent ?? 0, currency), to: COMMERCE_PATHS.accountSection('commandes') } : null,
    { label: 'Favoris', value: String(ids.length), to: COMMERCE_PATHS.accountSection('favoris') },
    { label: 'Adresses', value: String(me.addresses.length), to: COMMERCE_PATHS.accountSection('adresses') },
  ].filter(Boolean) as { label: string; value: string; to: string }[];

  return (
    <AccountShell section="overview" me={me} navigate={navigate}>
      <Heading title={`Bonjour ${me.firstName} !`} text="Retrouvez ici vos commandes, vos adresses de livraison et vos produits favoris." />
      {res.loading ? (
        <Loading />
      ) : (
        <>
          <div className={cn('grid gap-4 sm:grid-cols-2', cards.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-2')}>
            {cards.map((c) => (
              <Link key={c.label} to={c.to} navigate={navigate} className="group rounded-2xl border border-px-border-soft bg-white p-5 transition hover:border-px-primary/40 hover:shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-px-muted">{c.label}</p>
                <p className="mt-2 font-heading text-2xl font-semibold tabular-nums text-px-navy">{c.value}</p>
              </Link>
            ))}
          </div>

          {res.data?.ordersEnabled ? (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-px-navy">Dernières commandes</h2>
                {res.data.recent.length ? (
                  <Link to={COMMERCE_PATHS.accountSection('commandes')} navigate={navigate} className="text-sm font-medium text-px-primary hover:underline">
                    Tout voir
                  </Link>
                ) : null}
              </div>
              {res.data.recent.length ? (
                <OrdersTable items={res.data.recent} navigate={navigate} />
              ) : (
                <div className="rounded-2xl border border-dashed border-px-border p-8 text-center">
                  <p className="text-sm text-px-text">Vous n’avez pas encore passé de commande.</p>
                  <Button className="mt-4" onClick={() => navigate(COMMERCE_PATHS.shop)}>
                    Découvrir la boutique
                  </Button>
                </div>
              )}
            </section>
          ) : null}

          <section className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-px-border-soft bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-px-muted">Adresse par défaut</p>
              {defaultAddress ? (
                <p className="mt-3 text-sm leading-relaxed text-px-text">
                  {formatAddress(defaultAddress).map((l, i) => (
                    <span key={i} className={cn('block', i === 0 && 'font-semibold text-px-navy')}>
                      {l}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="mt-3 text-sm text-px-muted">Aucune adresse enregistrée.</p>
              )}
              <Link to={COMMERCE_PATHS.accountSection('adresses')} navigate={navigate} className="mt-4 inline-block text-sm font-medium text-px-primary hover:underline">
                Gérer mes adresses
              </Link>
            </div>
            <div className="rounded-2xl border border-px-border-soft bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-px-muted">Mes informations</p>
              <p className="mt-3 text-sm font-semibold text-px-navy">
                {me.firstName} {me.lastName}
              </p>
              <p className="text-sm text-px-text">{me.email}</p>
              {me.phone ? <p className="text-sm text-px-text">{me.phone}</p> : null}
              <Link to={COMMERCE_PATHS.accountSection('profil')} navigate={navigate} className="mt-4 inline-block text-sm font-medium text-px-primary hover:underline">
                Modifier mon profil
              </Link>
            </div>
          </section>
        </>
      )}
    </AccountShell>
  );
}

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

export function OrdersPage({ me, navigate, search, setMeta }: Props & { me: Me }) {
  const page = Math.max(1, Number(new URLSearchParams(search).get('page')) || 1);
  const res = useLoad(() => api.get<{ items: OrderSummary[]; total: number; ordersEnabled: boolean }>(`/orders?page=${page}`), [page]);
  useEffect(() => setMeta({ title: 'Mes commandes' }), [setMeta]);
  const pages = Math.ceil((res.data?.total ?? 0) / 10);
  const base = COMMERCE_PATHS.accountSection('commandes');

  return (
    <AccountShell section="commandes" me={me} navigate={navigate}>
      <Heading title="Mes commandes" text={res.data?.total ? `${res.data.total} commande${res.data.total > 1 ? 's' : ''}` : undefined} />
      {res.loading ? (
        <Loading />
      ) : res.error ? (
        <Notice tone="danger">{res.error}</Notice>
      ) : !res.data?.items.length ? (
        <EmptyState
          icon={Package}
          title="Aucune commande pour l’instant"
          text="Vos commandes passées avec ce compte apparaîtront ici."
          action={<Button onClick={() => navigate(COMMERCE_PATHS.shop)}>Découvrir la boutique</Button>}
        />
      ) : (
        <>
          <OrdersTable items={res.data.items} navigate={navigate} />
          {pages > 1 ? (
            <div className="mt-6 flex items-center justify-between text-sm text-px-text">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate(page - 1 > 1 ? `${base}?page=${page - 1}` : base)}>
                Précédentes
              </Button>
              <span>
                Page {page} sur {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => navigate(`${base}?page=${page + 1}`)}>
                Suivantes
              </Button>
            </div>
          ) : null}
        </>
      )}
    </AccountShell>
  );
}

export function OrderPage({ me, number, navigate, setMeta }: Props & { me: Me; number: string }) {
  const res = useLoad(() => api.get<{ order: OrderDetail }>(`/orders/${encodeURIComponent(number)}`), [number]);
  useEffect(() => setMeta({ title: `Commande ${number}` }), [setMeta, number]);
  const o = res.data?.order;

  return (
    <AccountShell section="commandes" me={me} navigate={navigate}>
      <Link to={COMMERCE_PATHS.accountSection('commandes')} navigate={navigate} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-px-muted hover:text-px-navy">
        <ArrowLeft className="h-4 w-4" /> Mes commandes
      </Link>
      {res.loading ? (
        <Loading />
      ) : !o ? (
        <Notice tone="danger">{res.error || 'Commande introuvable.'}</Notice>
      ) : (
        <>
          <Heading title={`Commande ${o.number}`} text={`Passée le ${formatOrderDate(o.createdAt)}`} action={<OrderStatusBadge status={o.status} />} />
          <OrderDetailView order={o} navigate={navigate} />
        </>
      )}
    </AccountShell>
  );
}

/* ------------------------------------------------------------------ */
/* Adresses                                                            */
/* ------------------------------------------------------------------ */

export function AddressesPage({ me, navigate, setMeta }: Props & { me: Me }) {
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => setMeta({ title: 'Mes adresses' }), [setMeta]);

  const save = async (d: AddressDraft) => {
    const r = await api.post<{ addresses: SavedAddress[] }>('/addresses', { ...d, id: editing && editing !== 'new' ? editing.id : undefined });
    patchMe({ addresses: r.addresses });
    setEditing(null);
  };
  const run = async (id: string, action: 'delete' | 'default') => {
    if (action === 'delete' && !window.confirm('Supprimer cette adresse ?')) return;
    setBusy(`${action}:${id}`);
    setError('');
    try {
      const r = await api.post<{ addresses: SavedAddress[] }>(`/addresses/${encodeURIComponent(id)}/${action}`);
      patchMe({ addresses: r.addresses });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <AccountShell section="adresses" me={me} navigate={navigate}>
      <Heading
        title="Mes adresses"
        text="Elles vous sont proposées au moment de commander."
        action={
          editing ? null : (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" /> Ajouter une adresse
            </Button>
          )
        }
      />
      {error ? (
        <Notice tone="danger" className="mb-6">
          {error}
        </Notice>
      ) : null}
      {editing ? (
        <div className="rounded-2xl border border-px-border-soft bg-white p-6 sm:p-8">
          <h2 className="mb-6 font-heading text-lg font-semibold text-px-navy">{editing === 'new' ? 'Nouvelle adresse' : 'Modifier l’adresse'}</h2>
          <AddressForm initial={editing === 'new' ? emptyAddress(me.firstName, me.lastName, me.phone) : editing} canSetDefault={me.addresses.length > 0 && (editing === 'new' || !editing.isDefault)} onSubmit={save} onCancel={() => setEditing(null)} />
        </div>
      ) : !me.addresses.length ? (
        <EmptyState icon={MapPin} title="Aucune adresse enregistrée" text="Ajoutez une adresse pour commander plus rapidement." action={<Button onClick={() => setEditing('new')}>Ajouter une adresse</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {me.addresses.map((a) => (
            <div key={a.id} className={cn('flex flex-col rounded-2xl border bg-white p-6', a.isDefault ? 'border-px-primary/50 ring-1 ring-px-primary/20' : 'border-px-border-soft')}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-heading text-base font-semibold text-px-navy">{a.label}</p>
                {a.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-px-primary/10 px-2.5 py-1 text-xs font-semibold text-px-primary">
                    <Star className="h-3 w-3" /> Par défaut
                  </span>
                ) : null}
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-px-text">
                {formatAddress(a).map((l, i) => (
                  <span key={i} className="block">
                    {l}
                  </span>
                ))}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-px-border-soft pt-4">
                <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </Button>
                {!a.isDefault ? (
                  <Button variant="ghost" size="sm" loading={busy === `default:${a.id}`} onClick={() => void run(a.id, 'default')}>
                    Définir par défaut
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" className="ml-auto text-rose-600 hover:bg-rose-50" loading={busy === `delete:${a.id}`} onClick={() => void run(a.id, 'delete')} aria-label={`Supprimer ${a.label}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountShell>
  );
}

/* ------------------------------------------------------------------ */
/* Favoris                                                             */
/* ------------------------------------------------------------------ */

const shopApi = createModuleApi(MODULE_IDS.shop);

function WishlistContent({ navigate }: { navigate: (p: string) => void }) {
  const ids = useWishlist();
  const [items, setItems] = useState<ProductCard[] | null>(null);
  const key = ids.join(',');

  useEffect(() => {
    if (!ids.length) return setItems([]);
    if (!isModuleActive(MODULE_IDS.shop)) return setItems([]);
    let alive = true;
    shopApi
      .post<{ items: ProductCard[] }>('/lookup', { ids })
      .then((r) => alive && setItems(ids.map((id) => r.items.find((p) => p.id === id)).filter(Boolean) as ProductCard[]))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!items) return <GridSkeleton count={4} columns={3} />;
  if (!items.length) {
    return <EmptyState icon={Heart} title="Aucun favori pour l’instant" text="Touchez le cœur d’un produit pour le retrouver ici." action={<Button onClick={() => navigate(COMMERCE_PATHS.shop)}>Découvrir la boutique</Button>} />;
  }
  return <ProductGrid items={items} navigate={navigate} columns={3} />;
}

export function WishlistPage({ me, navigate, setMeta }: Props & { me: Me | null }) {
  const ids = useWishlist();
  useEffect(() => setMeta({ title: 'Mes favoris' }), [setMeta]);
  const heading = <Heading title="Mes favoris" text={ids.length ? `${ids.length} produit${ids.length > 1 ? 's' : ''}` : undefined} />;

  if (!me) {
    return (
      <Container className="py-10 sm:py-14">
        {heading}
        <Notice tone="info" className="mb-8">
          Vos favoris sont gardés sur cet appareil.{' '}
          <Link to={`${COMMERCE_PATHS.login}?suite=${encodeURIComponent(COMMERCE_PATHS.accountSection('favoris'))}`} navigate={navigate} className="font-semibold underline">
            Connectez-vous
          </Link>{' '}
          pour les retrouver partout.
        </Notice>
        <WishlistContent navigate={navigate} />
      </Container>
    );
  }
  return (
    <AccountShell section="favoris" me={me} navigate={navigate}>
      {heading}
      <WishlistContent navigate={navigate} />
    </AccountShell>
  );
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

export function ProfilePage({ me, navigate, setMeta, settings }: Props & { me: Me }) {
  useEffect(() => setMeta({ title: 'Mon profil' }), [setMeta]);
  return (
    <AccountShell section="profil" me={me} navigate={navigate}>
      <Heading title="Mon profil" text={`Client depuis le ${formatOrderDate(me.createdAt)}`} />
      <ProfileSection me={me} navigate={navigate} avatars={settings.avatars !== false} />
    </AccountShell>
  );
}
