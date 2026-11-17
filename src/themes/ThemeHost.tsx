/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Chargement du thème actif (ou du thème prévisualisé dans l'administration) : feuille de style,
 * bundle et contexte fourni aux composants du thème. Si le thème ne peut pas être chargé,
 * un rendu minimal garde le site lisible.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ThemeDefinition, ThemeRuntimeValue } from '../../sdk/theme';
import type { SiteConfigPayload } from '../../sdk/content';
import { useSiteInfo, useSiteConfig, useSiteConfigLoaded, useTokens, type PublicThemeDescriptor } from '../context/SiteConfigContext';
import { IS_PREVIEW, usePreviewState } from '../preview';
import { ThemeContext } from '../runtime';
import { FALLBACK_THEME } from './fallback';

/** Thème actif au moment où le HTML a été servi : prioritaire sur la configuration, qui peut être en cache. */
const HTML_THEME: PublicThemeDescriptor | null = (() => {
  try {
    const raw = document.getElementById('snapify-theme')?.textContent;
    return raw ? (JSON.parse(raw) as PublicThemeDescriptor) : null;
  } catch {
    return null;
  }
})();

const loaded = new Map<string, Promise<ThemeDefinition | null>>();

function loadScript(d: PublicThemeDescriptor): Promise<ThemeDefinition | null> {
  let p = loaded.get(d.script);
  if (!p) {
    p = import(/* @vite-ignore */ d.script)
      .then((m: { default?: ThemeDefinition }) => {
        const t = m.default;
        return t && typeof t.Header === 'function' && typeof t.Footer === 'function' && typeof t.blocks === 'object' ? t : null;
      })
      .catch((e) => {
        console.error(`[thèmes] chargement impossible : ${d.id}`, e);
        return null;
      });
    loaded.set(d.script, p);
  }
  return p;
}

/** Une seule feuille de thème à la fois ; le serveur l'insère déjà dans le HTML pour le thème actif. */
function applyStylesheet(href: string | undefined): Promise<void> {
  let link = document.querySelector<HTMLLinkElement>('link[data-snapify-theme]');
  if (!href) {
    link?.remove();
    return Promise.resolve();
  }
  if (link && link.getAttribute('href') === href) return Promise.resolve();
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.snapifyTheme = '';
    document.head.appendChild(link);
  }
  const el = link;
  return new Promise((resolve) => {
    const done = () => resolve();
    el.addEventListener('load', done, { once: true });
    el.addEventListener('error', done, { once: true });
    setTimeout(done, 3000);
    el.href = href;
  });
}

const EMPTY_CONFIG: SiteConfigPayload = {
  general: { legalName: '', baseline: '', slogan: '', phone: '', phoneClean: '', contactEmail: '', slaHours: '', address: '' },
  branding: { siteName: '', tagline: '', logoUrl: '', colors: {} },
  menus: [],
  widgetAreas: [],
  settings: { cookieBannerEnabled: true, analyticsEnabled: true, maintenance: { enabled: false, title: '', message: '' } },
  redirects: [],
};

interface ActiveTheme {
  theme: ThemeDefinition;
  /** Change avec le thème : sert de clé pour réinitialiser les barrières d'erreur. */
  key: string;
  /** Faux pendant le chargement initial du thème. */
  ready: boolean;
}

const ActiveThemeContext = createContext<ActiveTheme>({ theme: FALLBACK_THEME, key: 'fallback', ready: false });

export const useActiveTheme = () => useContext(ActiveThemeContext);

export function ThemeProvider({
  path,
  navigate,
  openCookies,
  children,
}: {
  path: string;
  navigate: (path: string) => void;
  openCookies: () => void;
  children: React.ReactNode;
}) {
  const cfg = useSiteConfig();
  const configLoaded = useSiteConfigLoaded();
  const preview = usePreviewState();
  const info = useSiteInfo();
  const tokens = useTokens();

  const override = IS_PREVIEW ? preview?.theme : undefined;
  // Config live prioritaire (changement de thème sans recharger le HTML injecté)
  const descriptor = override
    ? override.descriptor
    : configLoaded && cfg?.theme
      ? cfg.theme
      : (HTML_THEME ?? cfg?.theme ?? null);
  const settings = useMemo(
    () => ({ ...(descriptor?.settings ?? {}), ...(override?.settings ?? {}) }),
    [descriptor?.settings, override?.settings]
  );

  const [state, setState] = useState<{ script: string | null; theme: ThemeDefinition } | null>(null);

  useEffect(() => {
    if (!configLoaded) return;
    if (!descriptor) {
      void applyStylesheet(undefined);
      setState({ script: null, theme: FALLBACK_THEME });
      return;
    }
    let alive = true;
    void Promise.all([loadScript(descriptor), applyStylesheet(descriptor.style)]).then(([theme]) => {
      if (alive) setState({ script: descriptor.script, theme: theme ?? FALLBACK_THEME });
    });
    return () => {
      alive = false;
    };
  }, [configLoaded, descriptor?.script, descriptor?.style]); // eslint-disable-line react-hooks/exhaustive-deps

  const runtime = useMemo<ThemeRuntimeValue>(
    () => ({ site: cfg ?? EMPTY_CONFIG, info, tokens, settings, path, navigate, openCookies, isPreview: IS_PREVIEW }),
    [cfg, info, tokens, settings, path, navigate, openCookies]
  );
  const active = useMemo<ActiveTheme>(() => ({ theme: state?.theme ?? FALLBACK_THEME, key: state?.script ?? 'fallback', ready: !!state }),
    [state]
  );

  return (
    <ThemeContext.Provider value={runtime}>
      <ActiveThemeContext.Provider value={active}>{children}</ActiveThemeContext.Provider>
    </ThemeContext.Provider>
  );
}

/** Isole une erreur d'un composant du thème pour ne pas faire tomber tout le site. */
export class ThemeBoundary extends React.Component<{ part: string; fallback?: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(`[thèmes] ${this.props.part} :`, error);
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
