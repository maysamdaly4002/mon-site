/**
 * Snapify — thème Preveris
 * © 2026 Hamdi Ayari — hamdi.ayari@novalabs.tn
 */
import { isPreviewMode, useSnapify } from '@snapify/sdk/theme';
import type { MenuItemDto } from '@snapify/sdk/content';

export type { MenuItemDto };

export interface PreverisOptions {
  palette: 'mist' | 'white' | 'brand';
  accent: 'ember' | 'flame' | 'brand';
  typography: 'modern' | 'editorial' | 'brand';
  corners: 'sharp' | 'soft' | 'round';
  glass: boolean;
  arches: boolean;
  animations: boolean;
  topBar: boolean;
  stickyHeader: boolean;
  headerPhone: boolean;
  footerWordmark: boolean;
  mobileBar: boolean;
}

export const IS_PREVIEW = isPreviewMode();

export const useOptions = (): PreverisOptions => useSnapify<PreverisOptions>().settings;

export const FALLBACK_MENU: MenuItemDto[] = [
  { id: 'home', label: 'Accueil', path: '/' },
  {
    id: 'etudes',
    label: 'Études',
    path: '/etudes/',
    children: [
      { id: 'at', label: 'Autorisation de travaux', path: '/etudes/autorisation-travaux/' },
      { id: 'pc', label: 'Permis de construire', path: '/etudes/permis-construire/' },
      { id: 'ssi', label: 'Coordination SSI', path: '/etudes/coordination-ssi/' },
    ],
  },
  {
    id: 'suivi',
    label: 'Suivi',
    path: '/suivi/',
    children: [
      { id: 'annuel', label: 'Suivi annuel', path: '/suivi/annuel/' },
      { id: 'rus', label: 'Responsable Unique de Sécurité', path: '/suivi/rus/' },
      { id: 'hotel', label: 'Suivi hôtel', path: '/suivi/hotel/' },
    ],
  },
  {
    id: 'collectivites',
    label: 'Collectivités',
    path: '/collectivites/',
  },
  { id: 'contact', label: 'Contact', path: '/contact/', highlight: true },
];

export function useMenus() {
  const { site } = useSnapify();
  const find = (id: string) => site.menus.find((m) => m.id === id)?.items;
  const primary = find('primary')?.length ? find('primary')! : FALLBACK_MENU;
  const mobile = find('mobile')?.length ? find('mobile')! : primary;
  const footer = find('footer') ?? [];
  const cta: MenuItemDto = primary.find((i) => i.highlight) ?? { id: 'cta', label: 'Parler de votre projet', path: '/contact/' };
  return { primary, mobile, footer, cta };
}

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
