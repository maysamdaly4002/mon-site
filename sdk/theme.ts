/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Contrat d'un thème : composants de présentation (en-tête, pied de page, rendu des blocs…).
 * Le site hôte charge les données, gère la navigation, l'aperçu et les modules ; le thème
 * ne fait qu'afficher. React et le contexte du site sont fournis par l'hôte à l'exécution.
 */
import { createElement, useContext, type ComponentType, type Context, type ReactNode } from 'react';
import type { BlockDataMap, BlockKind, BlockStyle, BlogPost, CmsPage, SiteConfigPayload, SiteInfo, TokenValues } from './content';

export interface ThemeRuntimeValue<S = Record<string, unknown>> {
  site: SiteConfigPayload;
  info: SiteInfo;
  /** Valeurs des variables {{telephone}}, {{email}}… utilisables dans les textes. */
  tokens: TokenValues;
  /** Options du thème choisies dans « Apparence > Personnaliser ». */
  settings: S;
  /** Adresse de la page affichée, toujours terminée par `/`. */
  path: string;
  navigate: (path: string) => void;
  openCookies: () => void;
  /** Site affiché dans l'aperçu de l'administration (aucune action réelle : formulaires, liens externes). */
  isPreview: boolean;
}

export interface ThemeChromeProps {
  path: string;
  navigate: (path: string) => void;
  openCookies: () => void;
}

export interface BlockProps<K extends BlockKind> {
  /** Données du bloc, complétées par les valeurs par défaut. */
  d: BlockDataMap[K];
  style: BlockStyle;
}

export type BlockRenderers = { [K in BlockKind]: ComponentType<BlockProps<K>> };

export interface ThemeDefinition {
  Header: ComponentType<ThemeChromeProps>;
  Footer: ComponentType<ThemeChromeProps>;
  /** Rendu de chaque type de bloc. Un bloc sans rendu n'est pas affiché. */
  blocks: Partial<BlockRenderers>;
  /** Enveloppe de tout le site : applique les options du thème (variables CSS, classes…). */
  Layout?: ComponentType<{ children: ReactNode }>;
  /** Mise en page d'une page ; `children` contient les blocs déjà rendus. */
  Page?: ComponentType<{ page: CmsPage; children: ReactNode }>;
  /** Mise en page d'un article ; `children` contient les blocs déjà rendus. */
  Post?: ComponentType<{ post: BlogPost; children: ReactNode }>;
  NotFound?: ComponentType<{ navigate: (path: string) => void }>;
}

export function defineTheme(theme: ThemeDefinition): ThemeDefinition {
  return theme;
}

interface HostRuntime {
  ThemeContext?: Context<ThemeRuntimeValue | null>;
  isPreview?: boolean;
  ModuleSlot?: ComponentType<{ name: ModuleSlotName }>;
  activeModules?: string[];
  slotModules?: Partial<Record<ModuleSlotName, string[]>>;
}

const host = () => (globalThis as { __SNAPIFY_RUNTIME__?: HostRuntime }).__SNAPIFY_RUNTIME__;

/** Emplacements que le thème place lui-même dans sa mise en page. */
export type ModuleSlotName = 'header-actions';

/**
 * Affiche les éléments des modules actifs pour cet emplacement (ex. icônes panier et compte
 * dans l'en-tête). Rien n'est rendu si aucun module ne l'utilise.
 */
export function ModuleSlot({ name }: { name: ModuleSlotName }) {
  const Slot = host()?.ModuleSlot;
  return Slot ? createElement(Slot, { name }) : null;
}

/** Un module actif occupe-t-il cet emplacement ? */
export const hasModuleSlot = (name: ModuleSlotName): boolean => !!host()?.slotModules?.[name]?.length;

/** Module actif sur le site (ex. `novalabs.shop`). */
export const isModuleActive = (id: string): boolean => !!host()?.activeModules?.includes(id);

/** Données du site et options du thème. Utilisable dans tout composant du thème. */
export function useSnapify<S = Record<string, unknown>>(): ThemeRuntimeValue<S> {
  const ctx = host()?.ThemeContext;
  if (!ctx) throw new Error('useSnapify() doit être utilisé dans un thème chargé par Snapify');
  const value = useContext(ctx);
  if (!value) throw new Error('useSnapify() appelé hors du site');
  return value as ThemeRuntimeValue<S>;
}

/** Équivalent hors composant de `useSnapify().isPreview`. */
export const isPreviewMode = (): boolean => !!host()?.isPreview;
