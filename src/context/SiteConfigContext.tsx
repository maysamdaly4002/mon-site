/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SITE_INFO } from '../data/siteData';
import { IS_PREVIEW, usePreviewState } from '../preview';
import type { BrandingPayload, MenuItemDto, SiteConfigPayload, SiteInfo, TokenValues } from '../../sdk/content';
import type { PublicModuleDescriptor, PublicThemeDescriptor } from '../../server/modules/types';

export type { BrandingPayload, MenuItemDto, PublicModuleDescriptor, PublicThemeDescriptor, SiteConfigPayload, SiteInfo };

/** Correspondance couleurs du backoffice → variables CSS du thème (src/index.css). */
const COLOR_VARS: Record<string, string> = {
  primary: '--px-primary',
  primaryHover: '--px-primary-dark',
  accent: '--px-accent',
  navy: '--px-navy',
  background: '--px-surface',
  text: '--px-text',
  muted: '--px-muted',
  border: '--px-border',
};

const PRELOADED_FONTS = new Set(['Poppins']);

function ensureFont(family: string) {
  if (!family || PRELOADED_FONTS.has(family)) return;
  const id = `px-font-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

export function applyBranding(branding: BrandingPayload | undefined) {
  if (!branding) return;
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
    const value = branding.colors?.[key];
    if (value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) root.style.setProperty(cssVar, value);
  }
  if (branding.fonts) {
    ensureFont(branding.fonts.body);
    ensureFont(branding.fonts.heading);
    root.style.setProperty('--px-font-body', `'${branding.fonts.body}'`);
    root.style.setProperty('--px-font-heading', `'${branding.fonts.heading}'`);
  }
  if (branding.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }
}

const SiteConfigContext = createContext<SiteConfigPayload | null>(null);
const SiteConfigLoadedContext = createContext(false);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const preview = usePreviewState();

  useEffect(() => {
    fetch('/api/public/site-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: SiteConfigPayload | null) => setConfig(cfg))
      .catch(() => setConfig(null))
      .finally(() => setLoaded(true));
  }, []);

  const effective = useMemo(() => {
    if (!config || !IS_PREVIEW || !preview?.site) return config;
    return { ...config, ...preview.site } as SiteConfigPayload;
  }, [config, preview?.site]);

  useEffect(() => {
    applyBranding(effective?.branding);
  }, [effective?.branding]);

  return (
    <SiteConfigLoadedContext.Provider value={loaded}>
      <SiteConfigContext.Provider value={effective}>{children}</SiteConfigContext.Provider>
    </SiteConfigLoadedContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

/** Vrai une fois la configuration reçue… ou son chargement échoué. */
export function useSiteConfigLoaded() {
  return useContext(SiteConfigLoadedContext);
}

/** Infos affichage — CMS prioritaire, fallback siteData */
export function useSiteInfo(): SiteInfo {
  const cfg = useSiteConfig();
  if (!cfg) return SITE_INFO;
  return {
    ...SITE_INFO,
    name: cfg.branding.siteName || SITE_INFO.name,
    legalName: cfg.general.legalName || SITE_INFO.legalName,
    baseline: cfg.general.baseline || SITE_INFO.baseline,
    slogan: cfg.general.slogan || SITE_INFO.slogan,
    phone: cfg.general.phone || SITE_INFO.phone,
    phoneClean: cfg.general.phoneClean || SITE_INFO.phoneClean,
    contactEmail: cfg.general.contactEmail || SITE_INFO.contactEmail,
    slaHours: cfg.general.slaHours || SITE_INFO.slaHours,
    address: cfg.general.address || SITE_INFO.address,
  };
}

/** Valeurs des variables {{…}} utilisables dans les textes des blocs. */
export function useTokens(): TokenValues {
  const info = useSiteInfo();
  return useMemo(
    () => ({ phone: info.phone, phoneClean: info.phoneClean, email: info.contactEmail, sla: info.slaHours, company: info.legalName }),
    [info.phone, info.phoneClean, info.contactEmail, info.slaHours, info.legalName]
  );
}
