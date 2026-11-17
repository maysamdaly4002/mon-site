/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { useEffect, useState } from 'react';
import type { ModuleApi } from '@snapify/sdk';

/** Chargement d'une route du module ; les données précédentes restent affichées pendant le rechargement. */
export function useFetch<T = unknown>(api: ModuleApi, path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: { message: string; status?: number } | null; loading: boolean }>({ data: null, error: null, loading: !!path });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get<T>(path).then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e: Error & { status?: number }) => alive && setState((s) => ({ data: s.data, error: { message: e.message, status: e.status }, loading: false }))
    );
    return () => {
      alive = false;
    };
  }, [api, path]);
  return state;
}
