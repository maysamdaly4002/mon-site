/**
 * Snapify — module Espace client
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { createModuleApi } from '@snapify/sdk';
import { getShared, MODULE_IDS, setCustomer, setShared, useShared, wishlist } from '@snapify/sdk/commerce';
import type { Me } from '../types';

export const api = createModuleApi(MODULE_IDS.customers);
const ME_KEY = 'customers:me';

/** Client connecté avec ses adresses (`undefined` : pas encore chargé). */
export const useMe = () => useShared<Me | null | undefined>(ME_KEY, undefined);

/** Enregistre le client connecté et fusionne les favoris du navigateur avec ceux du compte. */
export function applyMe(me: Me | null) {
  setShared(ME_KEY, me);
  setCustomer(me ? { id: me.id, firstName: me.firstName, lastName: me.lastName, email: me.email, phone: me.phone, avatarUrl: me.avatarUrl || undefined } : null);
  if (me) {
    const local = wishlist.ids();
    const merged = [...new Set([...me.wishlist, ...local])];
    if (merged.length !== local.length || merged.some((id, i) => id !== local[i])) wishlist.set(merged);
  }
}

export const patchMe = (patch: Partial<Me>) => {
  const me = getShared<Me | null>(ME_KEY);
  if (me) applyMe({ ...me, ...patch });
};

let loading: Promise<void> | null = null;

export function loadMe(force = false): Promise<void> {
  if (!force && (loading || getShared(ME_KEY) !== undefined)) return loading ?? Promise.resolve();
  loading = api
    .get<{ customer: Me | null }>('/me')
    .then((r) => applyMe(r.customer))
    .catch(() => applyMe(null))
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function logout() {
  await api.post('/logout').catch(() => undefined);
  applyMe(null);
  wishlist.set([]);
}
