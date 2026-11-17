/**
 * Snapify — module Commande
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PackageSearch, RefreshCw, Search, WifiOff } from 'lucide-react';
import { isModuleActive, type ModuleApiError, type PublicPageProps } from '@snapify/sdk';
import { COMMERCE_PATHS, MODULE_IDS, useCustomer, type OrderDetail } from '@snapify/sdk/commerce';
import { Breadcrumbs, Button, Container, EmptyState, FormField, Notice, TextInput } from '@snapify/sdk/ui/commerce';
import { formatOrderDate, OrderDetailView, OrderStatusBadge } from '@snapify/sdk/ui/orders';
import type { Settings } from '../types';

export function ConfirmationPage({ api, search, navigate, setMeta, settings }: PublicPageProps<Settings>) {
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const number = params.get('n') || '';
  const token = params.get('t') || '';
  const customer = useCustomer();
  const [state, setState] = useState<{ order: OrderDetail | null; error: 'not-found' | 'network' | null }>({ order: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setMeta({ title: 'Commande confirmée' }), [setMeta]);
  useEffect(() => {
    if (!number || !token) {
      setState({ order: null, error: 'not-found' });
      return;
    }
    let alive = true;
    setState({ order: null, error: null });
    api.get<{ order: OrderDetail }>(`/orders/${encodeURIComponent(number)}?t=${encodeURIComponent(token)}`).then(
      (r) => alive && setState({ order: r.order, error: null }),
      (e: ModuleApiError) => alive && setState({ order: null, error: e.status === 404 ? 'not-found' : 'network' })
    );
    return () => {
      alive = false;
    };
  }, [api, number, token, attempt]);

  if (state.error === 'network') {
    return (
      <Container className="py-20">
        <EmptyState
          icon={WifiOff}
          title="Connexion interrompue"
          text={`Votre commande${number ? ` ${number}` : ''} est bien enregistrée, mais son récapitulatif n’a pas pu être chargé. Vérifiez votre connexion puis réessayez.`}
          action={
            <Button onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw className="h-4 w-4" /> Réessayer
            </Button>
          }
        />
      </Container>
    );
  }
  if (state.error) {
    return (
      <Container className="py-20">
        <EmptyState icon={PackageSearch} title="Commande introuvable" text="Ce lien n’est plus valable. Retrouvez votre commande grâce à son numéro et votre adresse e-mail." action={<Button onClick={() => navigate(`/commande/suivi/${number ? `?n=${encodeURIComponent(number)}` : ''}`)}>Suivre une commande</Button>} />
      </Container>
    );
  }
  const o = state.order;
  if (!o) return <div className="min-h-[60vh]" aria-busy="true" />;

  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight text-px-navy sm:text-4xl">Merci, {o.address.firstName} !</h1>
        <p className="mt-3 text-[15px] text-px-text">
          Votre commande <strong className="text-px-navy">{o.number}</strong> est enregistrée. Un e-mail de confirmation a été envoyé à <strong className="text-px-navy">{o.email}</strong>.
        </p>
        {settings.thankYouText ? <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-px-muted">{settings.thankYouText}</p> : null}
      </div>
      <div className="mt-10">
        <OrderDetailView order={o} navigate={navigate} />
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button onClick={() => navigate(COMMERCE_PATHS.shop)}>Continuer mes achats</Button>
        {customer ? (
          <Button variant="outline" onClick={() => navigate(COMMERCE_PATHS.accountSection('commandes'))}>
            Mes commandes
          </Button>
        ) : isModuleActive(MODULE_IDS.customers) ? (
          <Button variant="outline" onClick={() => navigate(`${COMMERCE_PATHS.register}?email=${encodeURIComponent(o.email)}`)}>
            Créer mon compte
          </Button>
        ) : null}
      </div>
    </Container>
  );
}

export function TrackPage({ api, search, navigate, setMeta }: PublicPageProps<Settings>) {
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [number, setNumber] = useState(params.get('n') || '');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<OrderDetail | null>(null);

  useEffect(() => setMeta({ title: 'Suivre ma commande' }), [setMeta]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.post<{ order: OrderDetail }>('/track', { number, email });
      setOrder(r.order);
    } catch (err) {
      setOrder(null);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <Breadcrumbs navigate={navigate} items={[{ label: 'Accueil', to: '/' }, { label: 'Suivre ma commande' }]} />
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-px-navy sm:text-4xl">Suivre ma commande</h1>
      <p className="mt-2 text-[15px] text-px-muted">Saisissez le numéro reçu par e-mail et l’adresse utilisée pour commander.</p>
      <form onSubmit={submit} className="mt-8 grid gap-4 rounded-3xl border border-px-border-soft bg-px-surface/50 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField label="Numéro de commande">
          <TextInput value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="CMD-1001" required />
        </FormField>
        <FormField label="Adresse e-mail">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </FormField>
        <Button type="submit" loading={loading} variant="dark">
          <Search className="h-4 w-4" /> Rechercher
        </Button>
      </form>
      {error ? <Notice tone="danger" className="mt-6">{error}</Notice> : null}
      {order ? (
        <div className="mt-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-heading text-xl font-semibold text-px-navy">Commande {order.number}</p>
              <p className="text-sm text-px-muted">Passée le {formatOrderDate(order.createdAt)}</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
          <OrderDetailView order={order} navigate={navigate} />
        </div>
      ) : null}
    </Container>
  );
}
