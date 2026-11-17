/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { isDemoPath, toDemoUrl } from '../../demoBase';
import { api, type ClientSnapshot } from '../lib/api';
import { useAsync } from '../lib/hooks';

interface SiteState {
  site: ClientSnapshot | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<unknown>;
  /** Met à jour la copie locale après une sauvegarde réussie. */
  patchSite: <K extends keyof ClientSnapshot>(key: K, value: ClientSnapshot[K]) => void;
}

const SiteContext = createContext<SiteState | null>(null);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { data, setData, loading, error, reload } = useAsync(() => api.snapshot(), []);
  const patchSite = useCallback<SiteState['patchSite']>((key, value) => setData((s) => (s ? { ...s, [key]: value } : s)), [setData]);
  const value = useMemo(() => ({ site: data, loading, error, reload, patchSite }), [data, loading, error, reload, patchSite]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite hors SiteProvider');
  return ctx;
}

/** Le snapshot chargé (à utiliser sous un composant qui garantit sa présence). */
export function useSiteData(): ClientSnapshot {
  const { site } = useSite();
  if (!site) throw new Error('Site non chargé');
  return site;
}

/** Liens « Voir le site » : le CMS public est sous /demo/ (/ sert la landing produit). */
export function publicUrl(site: ClientSnapshot | null, path = '/'): string {
  const base = (site?.settings.publicUrl || window.location.origin).replace(/\/+$/, '');
  const raw = path.startsWith('/') ? path : `/${path}`;
  // API, sitemaps et robots restent à la racine ; le reste pointe vers la démo CMS.
  if (/^\/(api\/|sitemap|robots\.txt)/.test(raw) || isDemoPath(raw)) return `${base}${raw}`;
  return `${base}${toDemoUrl(raw)}`;
}
