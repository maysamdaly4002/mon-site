/**
 * Snapify — module Commande
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useRef, useState } from 'react';
import { Banknote, Landmark, Lock, ShieldCheck, ShoppingBag, Store, Tag, Truck, X, Zap } from 'lucide-react';
import { createModuleApi, isModuleActive, type PublicPageProps } from '@snapify/sdk';
import {
  cart,
  coupon as couponStore,
  COMMERCE_PATHS,
  formatMoney,
  GOVERNORATES,
  isEmail,
  MODULE_IDS,
  setCustomer,
  useCart,
  useCoupon,
  useCustomer,
  validateAddress,
  type Address,
  type CustomerSummary,
  type PaymentMethod,
  type Quote,
  type SavedAddress,
} from '@snapify/sdk/commerce';
import { Breadcrumbs, Button, Checkbox, Container, EmptyState, FormField, Link, Notice, OptionCard, SelectInput, TextArea, TextInput, cn } from '@snapify/sdk/ui/commerce';
import type { Settings, ShippingMethod, ShippingOption } from '../types';

interface QuoteResponse {
  quote: Quote;
  shippingOptions: ShippingOption[];
  shipping: ShippingMethod;
  shippingCost: number;
  grandTotal: number;
  payments: PaymentMethod[];
}

interface Draft {
  email: string;
  address: Address;
  shipping: ShippingMethod;
  payment: PaymentMethod | '';
  notes: string;
}

const DRAFT_KEY = 'snapify.checkout';
const EMPTY_ADDRESS: Address = { firstName: '', lastName: '', phone: '', line1: '', line2: '', city: '', governorate: '', postalCode: '' };

function readDraft(): Draft {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (d && typeof d === 'object') return { email: '', notes: '', shipping: 'home', payment: '', ...d, address: { ...EMPTY_ADDRESS, ...(d.address ?? {}) } };
  } catch {
    /* brouillon illisible : formulaire vide */
  }
  return { email: '', address: EMPTY_ADDRESS, shipping: 'home', payment: '', notes: '' };
}

type MeResponse = { customer: (CustomerSummary & { addresses: SavedAddress[] }) | null };

export function CheckoutPage({ api, settings, navigate, setMeta }: PublicPageProps<Settings>) {
  const { lines } = useCart();
  const code = useCoupon();
  const customer = useCustomer();
  const customersActive = isModuleActive(MODULE_IDS.customers);
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressId, setAddressId] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accept, setAccept] = useState(false);
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [refresh, setRefresh] = useState(0);
  const prefilled = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setMeta({ title: 'Commande' }), [setMeta]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* stockage indisponible */
    }
  }, [draft]);

  // Client connecté : coordonnées et carnet d'adresses.
  useEffect(() => {
    if (!customersActive) return;
    let alive = true;
    createModuleApi(MODULE_IDS.customers)
      .get<MeResponse>('/me')
      .then((r) => {
        if (!alive) return;
        setCustomer(r.customer ? { id: r.customer.id, firstName: r.customer.firstName, lastName: r.customer.lastName, email: r.customer.email, phone: r.customer.phone } : null);
        const list = r.customer?.addresses ?? [];
        setAddresses(list);
        if (r.customer && !prefilled.current) {
          prefilled.current = true;
          const def = list.find((a) => a.isDefault) ?? list[0];
          setDraft((d) => ({
            ...d,
            email: r.customer!.email,
            address: def ? { ...EMPTY_ADDRESS, ...stripSaved(def) } : { ...d.address, firstName: d.address.firstName || r.customer!.firstName, lastName: d.address.lastName || r.customer!.lastName, phone: d.address.phone || r.customer!.phone || '' },
          }));
          if (def) setAddressId(def.id);
        }
      })
      .catch(() => alive && setCustomer(null));
    return () => {
      alive = false;
    };
  }, [customersActive]);

  const lineKey = JSON.stringify(lines.map((l) => [l.productId, l.qty]));
  useEffect(() => {
    if (!lines.length) return;
    let alive = true;
    const t = setTimeout(() => {
      api
        .post<QuoteResponse>('/quote', { lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })), coupon: code, shipping: draft.shipping })
        .then((r) => {
          if (!alive) return;
          setData(r);
          setQuoteError('');
          if (r.shipping !== draft.shipping) setDraft((d) => ({ ...d, shipping: r.shipping }));
          if (!draft.payment || !r.payments.includes(draft.payment as PaymentMethod)) setDraft((d) => ({ ...d, payment: r.payments[0] ?? '' }));
        })
        .catch((e: Error) => alive && setQuoteError(e.message));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey, code, draft.shipping, refresh, api]);

  const setAddr = (patch: Partial<Address>) => {
    setAddressId('');
    setDraft((d) => ({ ...d, address: { ...d.address, ...patch } }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(patch)) delete n[k];
      return n;
    });
  };

  const quote = data?.quote;
  const issues = quote?.issues ?? [];
  const mustLogin = !settings.guestCheckout && customersActive && customer === null;
  const total = data?.grandTotal ?? 0;
  const belowMin = settings.minOrder > 0 && (quote?.total ?? 0) < settings.minOrder;
  const loginPath = `${COMMERCE_PATHS.login}?suite=${encodeURIComponent(COMMERCE_PATHS.checkout)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const { errors: addrErrors } = validateAddress(draft.address);
    const errs: Record<string, string> = { ...addrErrors };
    if (!isEmail(draft.email.trim())) errs.email = 'Adresse e-mail invalide';
    if (!draft.payment) errs.payment = 'Choisissez un mode de paiement';
    if (settings.termsPath && !accept) errs.terms = 'Veuillez accepter les conditions générales de vente';
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"], [data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.post<{ number: string; token: string }>('/orders', {
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        coupon: code,
        email: draft.email.trim(),
        address: draft.address,
        shipping: draft.shipping,
        payment: draft.payment,
        notes: draft.notes,
        acceptTerms: accept || !settings.termsPath,
        expectedTotal: total,
      });
      cart.clear();
      couponStore.set('');
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignoré */
      }
      navigate(COMMERCE_PATHS.confirmation(r.number, r.token));
    } catch (err) {
      setSubmitError((err as Error).message);
      setRefresh((n) => n + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!lines.length) {
    return (
      <Container className="py-20">
        <EmptyState icon={ShoppingBag} title="Votre panier est vide" text="Ajoutez des produits à votre panier avant de passer commande." action={<Button onClick={() => navigate(COMMERCE_PATHS.shop)}>Découvrir la boutique</Button>} />
      </Container>
    );
  }

  if (mustLogin) {
    return (
      <Container className="py-20">
        <EmptyState icon={Lock} title="Connectez-vous pour commander" text="La commande est réservée aux clients inscrits. Connectez-vous ou créez votre compte en quelques secondes." action={<Button onClick={() => navigate(loginPath)}>Se connecter</Button>} />
      </Container>
    );
  }

  const paymentIcons: Record<PaymentMethod, typeof Banknote> = { cod: Banknote, transfer: Landmark };
  const shippingIcons: Record<ShippingMethod, typeof Truck> = { home: Truck, express: Zap, pickup: Store };

  return (
    <div className="pb-20">
      <Container className="py-8 sm:py-10">
        <Breadcrumbs navigate={navigate} items={[{ label: 'Panier', to: COMMERCE_PATHS.cart }, { label: 'Commande' }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-px-navy sm:text-4xl">Finaliser ma commande</h1>
      </Container>

      <Container>
        <form ref={formRef} onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
          <div className="space-y-10">
            {submitError ? <Notice tone="danger">{submitError}</Notice> : null}
            {quoteError ? <Notice tone="danger">{quoteError}</Notice> : null}
            {issues.length ? (
              <Notice tone="warning">
                {issues.map((i) => (
                  <span key={i.productId} className="block">
                    {i.message}
                  </span>
                ))}
                <Link to={COMMERCE_PATHS.cart} navigate={navigate} className="mt-1 inline-block font-semibold underline">
                  Modifier mon panier
                </Link>
              </Notice>
            ) : null}

            <Step n={1} title="Vos coordonnées" aside={customersActive && customer === null ? <Link to={loginPath} navigate={navigate} className="text-sm font-semibold text-px-primary hover:underline">Déjà client ? Se connecter</Link> : null}>
              <FormField label="Adresse e-mail" error={errors.email} hint="Pour la confirmation et le suivi de votre commande." required>
                <TextInput type="email" autoComplete="email" value={draft.email} invalid={!!errors.email} aria-invalid={!!errors.email} onChange={(e) => { setDraft((d) => ({ ...d, email: e.target.value })); setErrors((x) => ({ ...x, email: '' })); }} />
              </FormField>
              {customer ? (
                <p className="text-sm text-px-muted">
                  Connecté en tant que <strong className="text-px-navy">{customer.firstName} {customer.lastName}</strong>.
                </p>
              ) : null}
            </Step>

            <Step n={2} title="Livraison">
              {addresses.length ? (
                <FormField label="Mes adresses">
                  <SelectInput
                    value={addressId}
                    onChange={(id) => {
                      const a = addresses.find((x) => x.id === id);
                      setAddressId(id);
                      if (a) {
                        setDraft((d) => ({ ...d, address: { ...EMPTY_ADDRESS, ...stripSaved(a) } }));
                        setErrors({});
                      }
                    }}
                    placeholder="Nouvelle adresse…"
                    options={addresses.map((a) => ({ value: a.id, label: `${a.label} — ${a.line1}, ${a.city}` }))}
                  />
                </FormField>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Prénom" error={errors.firstName} required>
                  <TextInput autoComplete="given-name" value={draft.address.firstName} invalid={!!errors.firstName} aria-invalid={!!errors.firstName} onChange={(e) => setAddr({ firstName: e.target.value })} />
                </FormField>
                <FormField label="Nom" error={errors.lastName} required>
                  <TextInput autoComplete="family-name" value={draft.address.lastName} invalid={!!errors.lastName} aria-invalid={!!errors.lastName} onChange={(e) => setAddr({ lastName: e.target.value })} />
                </FormField>
                <FormField label="Téléphone" error={errors.phone} hint="Le livreur vous appelle avant de passer." required className="sm:col-span-2">
                  <TextInput type="tel" autoComplete="tel" placeholder="+216 20 000 000" value={draft.address.phone} invalid={!!errors.phone} aria-invalid={!!errors.phone} onChange={(e) => setAddr({ phone: e.target.value })} />
                </FormField>
                <FormField label="Adresse" error={errors.line1} required className="sm:col-span-2">
                  <TextInput autoComplete="address-line1" placeholder="N°, rue, quartier" value={draft.address.line1} invalid={!!errors.line1} aria-invalid={!!errors.line1} onChange={(e) => setAddr({ line1: e.target.value })} />
                </FormField>
                <FormField label="Complément d’adresse" className="sm:col-span-2">
                  <TextInput autoComplete="address-line2" placeholder="Bâtiment, étage, repère…" value={draft.address.line2 ?? ''} onChange={(e) => setAddr({ line2: e.target.value })} />
                </FormField>
                <FormField label="Ville" error={errors.city} required>
                  <TextInput autoComplete="address-level2" value={draft.address.city} invalid={!!errors.city} aria-invalid={!!errors.city} onChange={(e) => setAddr({ city: e.target.value })} />
                </FormField>
                <div className="grid grid-cols-[1fr_110px] gap-4">
                  <FormField label="Gouvernorat" error={errors.governorate} required>
                    <SelectInput value={draft.address.governorate} onChange={(v) => setAddr({ governorate: v })} options={GOVERNORATES} placeholder="Choisir…" invalid={!!errors.governorate} />
                  </FormField>
                  <FormField label="Code postal" error={errors.postalCode}>
                    <TextInput inputMode="numeric" maxLength={4} autoComplete="postal-code" value={draft.address.postalCode} invalid={!!errors.postalCode} onChange={(e) => setAddr({ postalCode: e.target.value.replace(/\D/g, '') })} />
                  </FormField>
                </div>
              </div>

              <div className="space-y-3 pt-2" role="radiogroup" aria-label="Mode de livraison">
                <p className="text-[13px] font-medium text-px-navy">Mode de livraison</p>
                {(data?.shippingOptions ?? []).map((o) => (
                  <OptionCard
                    key={o.id}
                    icon={shippingIcons[o.id]}
                    checked={draft.shipping === o.id}
                    onSelect={() => setDraft((d) => ({ ...d, shipping: o.id }))}
                    title={o.label}
                    description={o.delay}
                    aside={
                      o.price ? (
                        formatMoney(o.price, quote?.currency)
                      ) : o.basePrice ? (
                        <span className="text-emerald-700">
                          <span className="mr-1.5 text-xs font-normal text-px-muted line-through">{formatMoney(o.basePrice, quote?.currency)}</span>Offerte
                        </span>
                      ) : (
                        <span className="text-emerald-700">Gratuit</span>
                      )
                    }
                  />
                ))}
              </div>
            </Step>

            <Step n={3} title="Paiement">
              <div className="space-y-3" role="radiogroup" aria-label="Mode de paiement" data-error={!!errors.payment}>
                {(data?.payments ?? []).map((p) => (
                  <OptionCard
                    key={p}
                    icon={paymentIcons[p]}
                    checked={draft.payment === p}
                    onSelect={() => {
                      setDraft((d) => ({ ...d, payment: p }));
                      setErrors((x) => ({ ...x, payment: '' }));
                    }}
                    title={p === 'cod' ? 'Paiement à la livraison' : 'Virement bancaire'}
                    description={p === 'cod' ? settings.codText : settings.transferText}
                  />
                ))}
                {data && !data.payments.length ? <Notice tone="warning">Aucun mode de paiement n’est disponible pour le moment. Contactez-nous pour commander.</Notice> : null}
                {errors.payment ? <p className="text-xs text-rose-600">{errors.payment}</p> : null}
              </div>
              <FormField label="Note pour la commande (facultatif)">
                <TextArea value={draft.notes} maxLength={1000} placeholder="Instructions de livraison, horaires…" onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
              </FormField>
            </Step>
          </div>

          <aside className="space-y-5 rounded-3xl border border-px-border-soft bg-px-surface/60 p-6 sm:p-8 lg:sticky lg:top-24">
            <h2 className="font-heading text-xl font-semibold text-px-navy">Votre commande</h2>
            <ul className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
              {(quote?.lines ?? []).map((l) => (
                <li key={l.productId} className="flex items-center gap-3">
                  <div className="relative h-16 w-14 shrink-0">
                    <div className="h-full w-full overflow-hidden rounded-lg bg-white">{l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : null}</div>
                    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-px-navy px-1 text-[11px] font-bold text-white">{l.qty}</span>
                  </div>
                  <p className="min-w-0 flex-1 line-clamp-2 text-sm text-px-navy">{l.name}</p>
                  <span className="text-sm font-semibold tabular-nums text-px-navy">{formatMoney(l.lineTotal, quote?.currency)}</span>
                </li>
              ))}
              {!quote ? [0, 1].map((i) => <li key={i} className="h-16 animate-pulse rounded-lg bg-white" />) : null}
            </ul>

            <div className="border-t border-px-border pt-5">
              {code && quote?.coupon ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-emerald-900">
                    <Tag className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      <strong>{quote.coupon.code}</strong> · {quote.coupon.label}
                    </span>
                  </span>
                  <button type="button" onClick={() => couponStore.set('')} aria-label="Retirer le code" className="rounded-md p-1 text-emerald-800 hover:bg-emerald-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <TextInput value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (couponInput.trim()) couponStore.set(couponInput); } }} placeholder="Code promo" aria-label="Code promo" className="h-10 uppercase" />
                  <Button variant="outline" size="sm" className="h-10" disabled={!couponInput.trim()} onClick={() => couponStore.set(couponInput)}>
                    Appliquer
                  </Button>
                </div>
              )}
              {code && quote?.couponError ? <p className="mt-2 text-xs text-rose-600">{quote.couponError}</p> : null}
            </div>

            <dl className="space-y-2.5 border-t border-px-border pt-5 text-sm">
              <Row label="Sous-total" value={quote ? formatMoney(quote.subtotal, quote.currency) : '—'} />
              {quote?.discount ? <Row label="Remise" value={`−${formatMoney(quote.discount, quote.currency)}`} tone="success" /> : null}
              <Row label="Livraison" value={data ? (data.shippingCost ? formatMoney(data.shippingCost, quote?.currency) : 'Offerte') : '—'} tone={data && !data.shippingCost ? 'success' : undefined} />
              <div className="flex items-baseline justify-between border-t border-px-border pt-4">
                <dt className="font-semibold text-px-navy">Total</dt>
                <dd className="text-2xl font-semibold tabular-nums text-px-navy">{data ? formatMoney(total, quote?.currency) : '—'}</dd>
              </div>
            </dl>

            {settings.termsPath ? (
              <div data-error={!!errors.terms}>
                <Checkbox checked={accept} onChange={(v) => { setAccept(v); setErrors((x) => ({ ...x, terms: '' })); }}>
                  J’ai lu et j’accepte les{' '}
                  <a href={settings.termsPath} target="_blank" rel="noreferrer" className="font-semibold text-px-navy underline">
                    conditions générales de vente
                  </a>
                  .
                </Checkbox>
                {errors.terms ? <p className="mt-1 text-xs text-rose-600">{errors.terms}</p> : null}
              </div>
            ) : null}

            {belowMin ? <Notice tone="warning">Montant minimum de commande : {formatMoney(settings.minOrder, quote?.currency)}.</Notice> : null}

            <Button type="submit" size="lg" block loading={submitting} disabled={!data || !quote?.lines.length || belowMin || !data.payments.length}>
              <Lock className="h-4 w-4" /> Confirmer la commande{data ? ` · ${formatMoney(total, quote?.currency)}` : ''}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-px-muted">
              <ShieldCheck className="h-3.5 w-3.5" /> Vos données sont transmises de façon sécurisée.
            </p>
          </aside>
        </form>
      </Container>
    </div>
  );
}

function stripSaved(a: SavedAddress): Address {
  const { id: _id, label: _label, isDefault: _d, ...rest } = a;
  return rest;
}

function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-heading text-xl font-semibold text-px-navy">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-px-navy text-sm font-bold text-white">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className={cn('flex justify-between', tone === 'success' && 'text-emerald-700')}>
      <dt className={tone ? undefined : 'text-px-text'}>{label}</dt>
      <dd className={cn('tabular-nums', !tone && 'text-px-navy')}>{value}</dd>
    </div>
  );
}
