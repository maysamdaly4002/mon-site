/**
 * Snapify — module Panier
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import { createModuleApi, isModuleActive, type ModuleApi } from '@snapify/sdk';
import { cart, MODULE_IDS, type CartLine, type Quote } from '@snapify/sdk/commerce';

/**
 * Recalcule le panier côté serveur (prix, stock, code promo) et met à jour les informations
 * mémorisées dans le navigateur quand elles ont changé.
 */
export function useQuote(api: ModuleApi, lines: CartLine[], coupon: string, enabled = true) {
  const key = JSON.stringify([lines.map((l) => [l.productId, l.qty]), coupon]);
  const [state, setState] = useState<{ key: string; quote: Quote | null; error: string | null }>({ key: '', quote: null, error: null });

  useEffect(() => {
    if (!enabled) return;
    if (!lines.length) {
      setState({ key, quote: null, error: null });
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      api
        .post<Quote>('/quote', { lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })), coupon })
        .then((quote) => {
          if (!alive) return;
          setState({ key, quote, error: null });
          const updates = quote.lines.filter((q) => {
            const l = lines.find((x) => x.productId === q.productId);
            return l && (l.price !== q.price || l.name !== q.name || l.slug !== q.slug || (l.image || '') !== q.image || l.qty > q.qty);
          });
          if (updates.length) cart.refresh(updates.map((q) => ({ productId: q.productId, name: q.name, price: q.price, image: q.image, slug: q.slug, maxQty: q.maxQty ?? undefined })));
        })
        .catch((e: Error) => alive && setState((s) => ({ ...s, key, error: e.message })));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { quote: state.quote, error: state.error, pending: !!lines.length && state.key !== key };
}

let shippingInfo: Promise<{ freeShippingThreshold: number } | null> | null = null;

/** Seuil de livraison offerte, si le module Commande est actif. */
export function useFreeShippingThreshold(): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!isModuleActive(MODULE_IDS.checkout)) return;
    shippingInfo ??= createModuleApi(MODULE_IDS.checkout)
      .get<{ freeShippingThreshold: number }>('/config')
      .catch(() => null);
    let alive = true;
    void shippingInfo.then((r) => alive && setValue(r?.freeShippingThreshold || 0));
    return () => {
      alive = false;
    };
  }, []);
  return value;
}
