/**
 * Snapify — module Panier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ShoppingBag, Truck, X } from 'lucide-react';
import { definePublicModule, isModuleActive, type PublicModuleProps } from '@snapify/sdk';
import { cart, COMMERCE_PATHS, formatMoney, MODULE_IDS, roundMoney, useCart } from '@snapify/sdk/commerce';
import { Button, Link, Price, QtyStepper, cn } from '@snapify/sdk/ui/commerce';
import { CartPage } from './CartPage';
import { useFreeShippingThreshold, useQuote } from './useQuote';
import type { Settings } from '../types';

const SCOPE = 'novalabs.cart';
/** Une seule instance de l'emplacement affiche le panier latéral, même si le thème place l'icône deux fois. */
let drawerOwner = 0;
let instances = 0;

function CartSlot(props: PublicModuleProps<Settings>) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<{ name: string; image?: string } | null>(null);
  const [bump, setBump] = useState(false);
  const id = useRef(0);
  const { settings, navigate } = props;

  useEffect(() => {
    id.current = ++instances;
    if (!drawerOwner) drawerOwner = id.current;
    return () => {
      if (drawerOwner === id.current) drawerOwner = 0;
    };
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      if (drawerOwner !== id.current) return;
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason;
      if (reason === 'add' && !settings.openDrawerOnAdd) return;
      if (!settings.drawerEnabled) {
        if (reason !== 'add') navigate(COMMERCE_PATHS.cart);
        return;
      }
      setAdded(null);
      setOpen(true);
    };
    const onAdded = (e: Event) => {
      setBump(true);
      setTimeout(() => setBump(false), 450);
      if (drawerOwner !== id.current) return;
      if (settings.drawerEnabled && settings.openDrawerOnAdd) return;
      const d = (e as CustomEvent<{ name?: string; image?: string }>).detail;
      setAdded({ name: d?.name || 'Produit', image: d?.image });
    };
    window.addEventListener('snapify:cart-open', onOpen);
    window.addEventListener('snapify:cart-added', onAdded);
    return () => {
      window.removeEventListener('snapify:cart-open', onOpen);
      window.removeEventListener('snapify:cart-added', onAdded);
    };
  }, [settings.openDrawerOnAdd, settings.drawerEnabled, navigate]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 4000);
    return () => clearTimeout(t);
  }, [added]);

  useEffect(() => setOpen(false), [props.path]);

  return (
    <>
      <a
        href={COMMERCE_PATHS.cart}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          if (settings.drawerEnabled && props.path !== COMMERCE_PATHS.cart) setOpen(true);
          else navigate(COMMERCE_PATHS.cart);
        }}
        aria-label={`Panier${count ? ` (${count} article${count > 1 ? 's' : ''})` : ''}`}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-current transition hover:bg-black/5"
      >
        <ShoppingBag className={cn('h-[22px] w-[22px] transition-transform', bump && 'scale-110')} strokeWidth={1.8} />
        {count ? (
          <span className={cn('absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-px-primary px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white transition-transform', bump && 'scale-125')}>
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </a>
      {open ? createPortal(<Scoped><CartDrawer {...props} onClose={() => setOpen(false)} /></Scoped>, document.body) : null}
      {added ? createPortal(<Scoped><AddedToast item={added} onClose={() => setAdded(null)} navigate={navigate} /></Scoped>, document.body) : null}
    </>
  );
}

function Scoped({ children }: { children: React.ReactNode }) {
  return <div data-snapify-scope={SCOPE}>{children}</div>;
}

function AddedToast({ item, onClose, navigate }: { item: { name: string; image?: string }; onClose: () => void; navigate: (p: string) => void }) {
  return (
    <div role="status" className="fixed inset-x-4 top-4 z-[120] mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-black/5 sm:left-auto sm:right-6 sm:top-6 sm:mx-0">
      {item.image ? <img src={item.image} alt="" className="h-14 w-14 rounded-xl object-cover" /> : null}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" /> Ajouté au panier
        </p>
        <p className="truncate text-sm font-medium text-px-navy">{item.name}</p>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate(COMMERCE_PATHS.cart);
          }}
          className="mt-0.5 text-[13px] font-semibold text-px-primary hover:underline"
        >
          Voir le panier
        </button>
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer" className="self-start rounded-lg p-1 text-px-muted hover:bg-px-surface">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function CartDrawer({ api, settings, navigate, onClose }: PublicModuleProps<Settings> & { onClose: () => void }) {
  const { lines, count, subtotal, currency } = useCart();
  const { quote } = useQuote(api, lines, '');
  const threshold = useFreeShippingThreshold();
  const [shown, setShown] = useState(false);
  const total = quote?.subtotal ?? subtotal;
  const checkoutActive = isModuleActive(MODULE_IDS.checkout);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    setShown(false);
    setTimeout(onClose, 220);
  };
  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const issues = new Map((quote?.issues ?? []).map((i) => [i.productId, i.message]));
  const remaining = threshold > 0 ? roundMoney(threshold - total) : 0;

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="Panier">
      <div className={cn('absolute inset-0 bg-black/40 transition-opacity duration-200', shown ? 'opacity-100' : 'opacity-0')} onClick={close} />
      <aside className={cn('absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-200 ease-out', shown ? 'translate-x-0' : 'translate-x-full')}>
        <header className="flex items-center justify-between border-b border-px-border-soft px-6 py-5">
          <p className="font-heading text-lg font-semibold text-px-navy">
            Votre panier {count ? <span className="text-px-muted">({count})</span> : null}
          </p>
          <button type="button" onClick={close} aria-label="Fermer le panier" className="rounded-full p-2 text-px-navy transition hover:bg-px-surface">
            <X className="h-5 w-5" />
          </button>
        </header>

        {threshold > 0 && lines.length ? (
          <div className="border-b border-px-border-soft px-6 py-4">
            <p className="flex items-center gap-2 text-[13px] text-px-text">
              <Truck className="h-4 w-4 text-px-primary" />
              {remaining > 0 ? (
                <span>
                  Plus que <strong className="text-px-navy">{formatMoney(remaining, currency)}</strong> pour la livraison offerte
                </span>
              ) : (
                <strong className="text-emerald-700">Livraison offerte !</strong>
              )}
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-px-surface">
              <div className="h-full rounded-full bg-px-primary transition-all duration-500" style={{ width: `${Math.min(100, (total / threshold) * 100)}%` }} />
            </div>
          </div>
        ) : null}

        {!lines.length ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-px-surface text-px-primary">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="mt-5 font-heading text-lg font-semibold text-px-navy">Votre panier est vide</p>
            <p className="mt-1.5 text-sm text-px-muted">Découvrez nos produits et laissez-vous tenter.</p>
            <Button className="mt-6" onClick={() => go(settings.continuePath || COMMERCE_PATHS.shop)}>
              Découvrir la boutique
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-px-border-soft overflow-y-auto px-6">
              {lines.map((l) => (
                <li key={l.productId} className="flex gap-4 py-5">
                  <Link to={COMMERCE_PATHS.product(l.slug)} navigate={go} className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-px-surface">
                    {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={COMMERCE_PATHS.product(l.slug)} navigate={go} className="line-clamp-2 text-sm font-medium text-px-navy hover:text-px-primary">
                        {l.name}
                      </Link>
                      <button type="button" onClick={() => cart.remove(l.productId)} aria-label={`Retirer ${l.name}`} className="-mr-1 rounded-md p-1 text-px-muted transition hover:bg-px-surface hover:text-rose-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Price amount={l.price} currency={l.currency} size="sm" className="mt-1" />
                    {issues.get(l.productId) ? <p className="mt-1 text-xs text-rose-600">{issues.get(l.productId)}</p> : null}
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <QtyStepper size="sm" value={l.qty} max={quote?.lines.find((q) => q.productId === l.productId)?.maxQty ?? undefined} onChange={(n) => cart.setQty(l.productId, n)} />
                      <span className="text-sm font-semibold tabular-nums text-px-navy">{formatMoney(l.price * l.qty, l.currency)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="border-t border-px-border-soft bg-px-surface/50 px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-px-text">Sous-total</span>
                <span className="text-lg font-semibold tabular-nums text-px-navy">{formatMoney(total, currency)}</span>
              </div>
              {settings.note ? <p className="mt-1 text-xs text-px-muted">{settings.note}</p> : null}
              <div className="mt-4 grid gap-2">
                {checkoutActive ? (
                  <Button size="lg" block onClick={() => go(COMMERCE_PATHS.checkout)}>
                    Commander
                  </Button>
                ) : null}
                <Button variant="outline" size="lg" block onClick={() => go(COMMERCE_PATHS.cart)}>
                  Voir le panier
                </Button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

export default definePublicModule<Settings>({
  slots: { 'header-actions': CartSlot },
  page: CartPage,
});
