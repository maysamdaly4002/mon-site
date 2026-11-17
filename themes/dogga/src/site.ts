/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { isPreviewMode, useSnapify } from '@snapify/sdk/theme';
import type { MenuItemDto } from '@snapify/sdk/content';

export type { MenuItemDto };

export interface DoggaOptions {
  palette: 'stone' | 'white' | 'brand';
  accent: 'terracotta' | 'olive' | 'indigo' | 'brand';
  typography: 'editorial' | 'modern' | 'brand';
  corners: 'sharp' | 'soft' | 'round';
  arches: boolean;
  animations: boolean;
  topBar: boolean;
  stickyHeader: boolean;
  headerPhone: boolean;
  footerWordmark: boolean;
  mobileBar: boolean;
}

export const IS_PREVIEW = isPreviewMode();

export const useOptions = (): DoggaOptions => useSnapify<DoggaOptions>().settings;

export const FALLBACK_MENU: MenuItemDto[] = [
  { id: 'home', label: 'Accueil', path: '/' },
  { id: 'contact', label: 'Contact', path: '/contact/', highlight: true },
];

export function useMenus() {
  const { site } = useSnapify();
  const find = (id: string) => site.menus.find((m) => m.id === id)?.items;
  const primary = find('primary')?.length ? find('primary')! : FALLBACK_MENU;
  const mobile = find('mobile')?.length ? find('mobile')! : primary;
  const footer = find('footer') ?? [];
  const cta: MenuItemDto = primary.find((i) => i.highlight) ?? { id: 'cta', label: 'Nous contacter', path: '/contact/' };
  return { primary, mobile, footer, cta };
}

/** Suit un lien de menu : interne (routeur du site), ancre, externe ou nouvel onglet. */
export function followLink(path: string, navigate: (p: string) => void, newTab?: boolean) {
  if (IS_PREVIEW && !path.startsWith('/') && !path.startsWith('#')) return;
  if (newTab) window.open(path, '_blank', 'noopener,noreferrer');
  else if (/^(https?:)?\/\//.test(path)) window.open(path, '_blank', 'noopener,noreferrer');
  else if (/^(tel|mailto):/.test(path)) window.location.href = path;
  else if (path.startsWith('#')) document.querySelector(path)?.scrollIntoView({ behavior: 'smooth' });
  else {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
