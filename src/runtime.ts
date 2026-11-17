/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Exécution partagée avec les bundles des modules et des thèmes : ils n'embarquent pas React
 * et lisent le contexte du thème depuis globalThis.__SNAPIFY_RUNTIME__.
 */
import React, { createContext } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import { SNAPIFY_MODULE_API_VERSION, type ModuleSlot } from '../sdk/index';
import type { ThemeRuntimeValue } from '../sdk/theme';
import { IS_PREVIEW } from './preview';

export interface SnapifyRuntime {
  React: typeof React;
  jsxRuntime: typeof jsxRuntime;
  ReactDOM: typeof ReactDOM;
  apiVersion: string;
  ThemeContext: React.Context<ThemeRuntimeValue | null>;
  isPreview: boolean;
  /** Emplacement de modules placé par le thème (`<ModuleSlot name="header-actions" />`). */
  ModuleSlot?: React.ComponentType<{ name: ModuleSlot }>;
  activeModules?: string[];
  slotModules?: Partial<Record<ModuleSlot, string[]>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __SNAPIFY_RUNTIME__: SnapifyRuntime | undefined;
}

export const ThemeContext = createContext<ThemeRuntimeValue | null>(null);

globalThis.__SNAPIFY_RUNTIME__ = { React, jsxRuntime, ReactDOM, apiVersion: SNAPIFY_MODULE_API_VERSION, ThemeContext, isPreview: IS_PREVIEW };
