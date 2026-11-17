/**
 * Snapify — module Panier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Lock, ShoppingBag, Tag, Trash2, Truck, X } from 'lucide-react';
import { isModuleActive, type PublicPageProps } from '@snapify/sdk';
import { cart, coupon as couponStore, COMMERCE_PATHS, formatMoney, MODULE_IDS, roundMoney, useCart, useCoupon } from '@snapify/sdk/commerce';
import { Breadcrumbs, Button, Container, EmptyState, Link, Notice, Price, QtyStepper, TextInput, cn } from '@snapify/sdk/ui/commerce';
import { useFreeShippingThreshold, useQuote } from './useQuote';
import type { Settings } from '../types';

export function CartPage({ api, settings, navigate, setMeta, path }: PublicPageProps<Settings>) {
  const { lines, count, currency } = useCart();
  const code = useCoupon();
  const { quote, pending } = useQuote(api, lines, settings.couponsEnabled ? code : '');
  const threshold = useFreeShippingThreshold();
  const [input, setInput] = useState('');
  const checkoutActive = isModuleActive(MODULE_IDS.checkout);

  useEffect(() => setMeta({ title: 'Panier' }), [setMeta]);
  if (path !== COMMERCE_PATHS.cart) return null;

  if (!lines.length) {
    return (
      <Container className="py-16 sm:py-24">
        <EmptyState
          icon={ShoppingBag}
          title="Votre panier est vide"
          text="Parcourez la boutique et ajoutez les produits qui vous plaisent : ils vous attendront ici."
          action={<Button onClick={() => navigate(settings.continuePath || COMMERCE_PATHS.shop)}>Découvrir la boutique</Button>}
        />
      </Container>
    );
  }

  const issues = new Map((quote?.issues ?? []).map((i) => [i.productId, i.message]));
  const subtotal = quote?.subtotal ?? roundMoney(lines.reduce((n, l) => n + l.price * l.qty, 0));
  const discount = quote?.discount ?? 0;
  const total = quote?.total ?? subtotal;
  const remaining = threshold > 0 ? roundMoney(threshold - total) : 0;
  const unavailable = lines.filter((l) => !quote?.lines.some((q) => q.productId === l.productId) && issues.has(l.productId));

  return (
    <div className="pb-20">
      <Container className="py-8 sm:py-12">
        <Breadcrumbs navigate={navigate} items={[{ label: 'Accueil', to: '/' }, { label: 'Panier' }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-px-navy sm:text-4xl">
            Panier <span className="text-px-muted">({count})</span>
          </h1>
          <Link to={settings.continuePath || COMMERCE_PATHS.shop} navigate={navigate} className="inline-flex items-center gap-2 text-sm font-semibold text-px-navy hover:text-px-primary">
            <ArrowLeft className="h-4 w-4" /> Continuer mes achats
          </Link>
        </div>
      </Container>

      <Container className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start">
        <div>
          {unavailable.length ? (
            <Notice tone="warning" className="mb-6">
              Certains produits ne sont plus disponibles et ne seront pas commandés.{' '}
              <button type="button" className="font-semibold underline" onClick={() => unavailable.forEach((l) => cart.remove(l.productId))}>
                Les retirer
              </button>
            </Notice>
          ) : null}
          <div className="hidden grid-cols-[1fr_140px_120px_40px] gap-4 border-b border-px-border-soft pb-3 text-xs font-semibold uppercase tracking-[0.12em] text-px-muted md:grid">
            <span>Produit</span>
            <span>Quantité</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <ul className="divide-y divide-px-border-soft">
            {lines.map((l) => {
              const priced = quote?.lines.find((q) => q.productId === l.productId);
              return (
                <li key={l.productId} className={cn('grid grid-cols-[88px_1fr] gap-4 py-6 md:grid-cols-[1fr_140px_120px_40px] md:items-center', !priced && quote && 'opacity-60')}>
                  <div className="contents md:flex md:items-center md:gap-4">
                    <Link to={COMMERCE_PATHS.product(l.slug)} navigate={navigate} className="row-span-2 h-28 w-[88px] shrink-0 overflow-hidden rounded-xl bg-px-surface md:row-span-1 md:h-24 md:w-20">
                      {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : null}
                    </Link>
                    <div className="min-w-0">
                      <Link to={COMMERCE_PATHS.product(l.slug)} navigate={navigate} className="line-clamp-2 font-medium text-px-navy hover:text-px-primary">
                        {l.name}
                      </Link>
                      <Price amount={l.price} currency={l.currency} size="sm" className="mt-1" />
                      {issues.get(l.productId) ? <p className="mt-1 text-xs text-rose-600">{issues.get(l.productId)}</p> : null}
                    </div>
                  </div>
                  <div className="col-start-2 flex items-center justify-between gap-3 md:col-start-auto md:block">
                    <QtyStepper size="sm" value={l.qty} max={priced?.maxQty ?? undefined} onChange={(n) => cart.setQty(l.productId, n)} />
                    <span className="font-semibold tabular-nums text-px-navy md:hidden">{formatMoney(priced?.lineTotal ?? l.price * l.qty, l.currency)}</span>
                  </div>
                  <span className="hidden text-right font-semibold tabular-nums text-px-navy md:block">{formatMoney(priced?.lineTotal ?? l.price * l.qty, l.currency)}</span>
                  <button type="button" onClick={() => cart.remove(l.productId)} aria-label={`Retirer ${l.name}`} className="col-start-2 justify-self-start rounded-lg p-2 text-px-muted transition hover:bg-px-surface hover:text-rose-600 md:col-start-auto md:justify-self-end">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => cart.clear()} className="mt-4 text-sm text-px-muted underline-offset-4 hover:text-rose-600 hover:underline">
            Vider le panier
          </button>
        </div>

        <aside className="rounded-3xl border border-px-border-soft bg-px-surface/60 p-6 sm:p-8 lg:sticky lg:top-24">
          <h2 className="font-heading text-xl font-semibold text-px-navy">Récapitulatif</h2>

          {threshold > 0 ? (
            <div className="mt-5 rounded-2xl bg-white p-4">
              <p className="flex items-center gap-2 text-[13px] text-px-text">
                <Truck className="h-4 w-4 shrink-0 text-px-primary" />
                {remaining > 0 ? (
                  <span>
                    Plus que <strong className="text-px-navy">{formatMoney(remaining, currency)}</strong> pour la livraison offerte
                  </span>
                ) : (
                  <strong className="text-emerald-700">Vous bénéficiez de la livraison offerte</strong>
                )}
              </p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-px-surface">
                <div className="h-full rounded-full bg-px-primary transition-all duration-500" style={{ width: `${Math.min(100, (total / threshold) * 100)}%` }} />
              </div>
            </div>
          ) : null}

          {settings.couponsEnabled ? (
            <div className="mt-6">
              {code && quote?.coupon ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
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
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) couponStore.set(input);
                  }}
                >
                  <TextInput value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="Code promo" aria-label="Code promo" className="uppercase" />
                  <Button type="submit" variant="dark" disabled={!input.trim()}>
                    Appliquer
                  </Button>
                </form>
              )}
              {code && quote?.couponError ? <p className="mt-2 text-xs text-rose-600">{quote.couponError}</p> : null}
            </div>
          ) : null}

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-px-text">Sous-total</dt>
              <dd className="font-medium tabular-nums text-px-navy">{formatMoney(subtotal, currency)}</dd>
            </div>
            {discount ? (
              <div className="flex justify-between text-emerald-700">
                <dt>Remise</dt>
                <dd className="font-medium tabular-nums">−{formatMoney(discount, currency)}</dd>
              </div>
            ) : null}
            {quote?.coupon?.freeShipping ? (
              <div className="flex justify-between text-emerald-700">
                <dt>Livraison</dt>
                <dd className="font-medium">Offerte</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-px-border pt-4">
              <dt className="font-semibold text-px-navy">Total</dt>
              <dd className={cn('text-2xl font-semibold tabular-nums text-px-navy transition-opacity', pending && 'opacity-50')}>{formatMoney(total, currency)}</dd>
            </div>
          </dl>
          {settings.note ? <p className="mt-2 text-xs text-px-muted">{settings.note}</p> : null}

          {checkoutActive ? (
            <Button size="lg" block className="mt-6" disabled={!quote?.lines.length} onClick={() => navigate(COMMERCE_PATHS.checkout)}>
              <Lock className="h-4 w-4" /> Passer la commande
            </Button>
          ) : (
            <Notice className="mt-6">La commande en ligne sera bientôt disponible.</Notice>
          )}
        </aside>
      </Container>
    </div>
  );
}
