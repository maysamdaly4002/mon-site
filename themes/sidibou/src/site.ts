/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/** Accès aux données du site fournies par Snapify, sous la forme utilisée par les composants du thème. */
import { isPreviewMode, useSnapify } from '@snapify/sdk/theme';
import type { MenuItemDto, SiteConfigPayload, SiteInfo, TokenValues } from '@snapify/sdk/content';

export type { MenuItemDto };

export interface SidiBouOptions {
  stickyHeader: boolean;
  headerPhone: boolean;
  buttonShape: 'pill' | 'rounded' | 'square';
  cardRadius: number;
  animations: boolean;
  mobileBar: boolean;
  backToTop: boolean;
}

export const IS_PREVIEW = isPreviewMode();

export const useSiteConfig = (): SiteConfigPayload => useSnapify().site;
export const useSiteInfo = (): SiteInfo => useSnapify().info;
export const useTokens = (): TokenValues => useSnapify().tokens;
export const useOptions = (): SidiBouOptions => useSnapify<SidiBouOptions>().settings;
