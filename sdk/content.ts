/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Modèle de contenu partagé avec les thèmes : blocs, pages, articles et configuration publique
 * du site. Un thème rend ces données ; il ne les modifie jamais.
 */
import type { PublicModuleDescriptor, PublicThemeDescriptor } from '../server/modules/types';

export type * from '../server/cms/blocks';
import type { WidgetArea } from '../server/cms/types';

export type { BlogPost, CmsBlock, CmsPage, ContactFormConfig, WidgetArea, WidgetInstance } from '../server/cms/types';
export { applyTokens } from '../server/cms/blocks';

export interface MenuItemDto {
  id: string;
  label: string;
  path: string;
  children?: MenuItemDto[];
  highlight?: boolean;
  openInNewTab?: boolean;
}

export interface BrandingPayload {
  siteName: string;
  tagline: string;
  logoUrl: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  colors: Record<string, string>;
  fonts?: { heading: string; body: string };
}

/** Configuration publique du site (`/api/public/site-config`). */
export interface SiteConfigPayload {
  general: {
    legalName: string;
    baseline: string;
    slogan: string;
    phone: string;
    phoneClean: string;
    contactEmail: string;
    slaHours: string;
    address: string;
  };
  branding: BrandingPayload;
  menus: { id: string; label: string; items: MenuItemDto[] }[];
  widgetAreas?: WidgetArea[];
  floatingButtons?: { id: string; label: string; path: string; style: 'primary' | 'outline' | 'ghost'; enabled: boolean }[];
  newsletterEnabled?: boolean;
  modules?: PublicModuleDescriptor[];
  theme?: PublicThemeDescriptor | null;
  settings: {
    cookieBannerEnabled: boolean;
    analyticsEnabled: boolean;
    maintenance: { enabled: boolean; title: string; message: string };
  };
  redirects: { from: string; to: string; permanent: boolean }[];
}

/** Coordonnées du site, complétées par des valeurs par défaut si un champ est vide. */
export interface SiteInfo {
  name: string;
  legalName: string;
  baseline: string;
  slogan: string;
  phone: string;
  phoneClean: string;
  contactEmail: string;
  slaHours: string;
  address: string;
}
