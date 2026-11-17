/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CookieBanner } from './components/CookieBanner';
import { SiteAnalytics } from './components/SiteAnalytics';
import { MaintenanceGate } from './components/MaintenanceGate';
import { useSiteConfig } from './context/SiteConfigContext';
import { ModulePageHost, ModuleSlotHost, useModuleRoute, useModuleRuntime } from './modules/ModuleHost';
import { CmsPageView } from './views/CmsPageView';
import { BlogPostView } from './views/BlogPostView';
import { IS_PREVIEW, usePreviewState } from './preview';
import { ThemeBoundary, ThemeProvider, useActiveTheme } from './themes/ThemeHost';
import type { CmsPage } from '../server/cms/types';
import { isDemoPath, showPlatformDemoBanner, toCmsPath, toDemoUrl } from './demoBase';

const normalize = (p: string) => (p ? (p.endsWith('/') ? p : `${p}/`) : '/');

/** Paramètres de l'adresse, sans celui de l'aperçu de l'administration. */
function currentSearch(): string {
  const params = new URLSearchParams(window.location.search);
  params.delete('cms-preview');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

const DEFAULT_TITLE = 'Snapify Démo';
const DEFAULT_DESCRIPTION = 'Démonstration Snapify CMS — base restaurée toutes les 24 heures.';

export default function App() {
  const siteConfig = useSiteConfig();
  const preview = usePreviewState();
  const [currentPath, setCurrentPath] = useState(() => normalize(toCmsPath(window.location.pathname)));
  const [search, setSearch] = useState(currentSearch);
  const [cookieBannerOpen, setCookieBannerOpen] = useState(false);
  const [loaded, setLoaded] = useState<{ path: string; page: CmsPage | null } | null>(null);
  const demoMode = showPlatformDemoBanner(window.location.pathname);

  useEffect(() => {
    if (IS_PREVIEW || localStorage.getItem('snapify_cookie_consent')) return;
    const timer = setTimeout(() => setCookieBannerOpen(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const open = () => setCookieBannerOpen(true);
    const pop = () => {
      setCurrentPath(normalize(toCmsPath(window.location.pathname)));
      setSearch(currentSearch());
    };
    window.addEventListener('snapify:open-cookies', open);
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('snapify:open-cookies', open);
      window.removeEventListener('popstate', pop);
    };
  }, []);

  useModuleRuntime();
  const moduleRoute = useModuleRoute(currentPath);
  const siteName = siteConfig?.branding.siteName || 'Snapify';
  const setModuleMeta = useCallback(
    (meta: { title?: string; description?: string }) => {
      if (meta.title !== undefined) document.title = meta.title ? `${meta.title} | ${siteName}` : siteName;
      if (meta.description !== undefined) document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description || DEFAULT_DESCRIPTION);
    },
    [siteName]
  );

  useEffect(() => {
    if (currentPath.startsWith('/blog/') || moduleRoute) return;
    let alive = true;
    fetch(`/api/public/pages/by-path?path=${encodeURIComponent(currentPath)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((page: CmsPage | null) => alive && setLoaded({ path: currentPath, page }));
    return () => {
      alive = false;
    };
  }, [currentPath, moduleRoute]);

  const previewPage = IS_PREVIEW ? preview?.page ?? null : null;
  const previewPost = IS_PREVIEW ? preview?.post ?? null : null;
  const page = previewPage ?? (loaded?.path === currentPath ? loaded.page : undefined);

  useEffect(() => {
    if (previewPost) {
      document.title = previewPost.seo?.seoTitle || `${previewPost.title} | ${siteName}`;
      document.querySelector('meta[name="description"]')?.setAttribute('content', previewPost.seo?.metaDescription || DEFAULT_DESCRIPTION);
      return;
    }
    if (page === undefined || (moduleRoute && !previewPage)) return;
    document.title = page?.seo?.seoTitle || (page ? `${page.title} | ${siteName}` : DEFAULT_TITLE);
    document.querySelector('meta[name="description"]')?.setAttribute('content', page?.seo?.metaDescription || DEFAULT_DESCRIPTION);
  }, [page, moduleRoute, previewPage, previewPost, siteName]);

  const navigate = useCallback((target: string) => {
    // L'aperçu d'une page/article en cours d'édition reste figé.
    if (previewPage || previewPost) return;
    const [newPath, query = ''] = target.split('?');
    let clean = normalize(isDemoPath(newPath) ? toCmsPath(newPath) : newPath.startsWith('/') ? newPath : `/${newPath}`);
    const rule = (siteConfig?.redirects || []).find((r) => r.from === clean || r.from === newPath);
    if (rule) clean = normalize(rule.to);
    const qs = query ? `?${query}` : '';
    const browserPath = toDemoUrl(clean);
    try {
      window.history.pushState({}, '', IS_PREVIEW ? `${browserPath}?cms-preview=1${query ? `&${query}` : ''}` : `${browserPath}${qs}`);
    } catch {
      /* navigation bloquée par le navigateur */
    }
    setCurrentPath(clean);
    setSearch(qs);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [previewPage, previewPost, siteConfig?.redirects]);
  const openCookies = useCallback(() => setCookieBannerOpen(true), []);

  useEffect(() => {
    /** Réécrit les liens absolus CMS (/blog/…) vers /demo/… */
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || /^(https?:)?\/\//i.test(href)) return;
      if (href.startsWith('/administrator') || href.startsWith('/api/') || href.startsWith('/_') || href === '/') return;
      if (!href.startsWith('/')) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);

  const renderCurrentView = () => {
    if (previewPost) {
      return (
        <BlogPostView
          slug={previewPost.slug}
          onNavigate={navigate}
          previewPost={previewPost}
          selectedBlockId={preview?.selectedBlockId}
        />
      );
    }
    if (!previewPage && currentPath.startsWith('/blog/')) {
      const slug = currentPath.split('/').filter(Boolean)[1];
      if (slug) return <BlogPostView slug={slug} onNavigate={navigate} />;
    }
    if (!previewPage && moduleRoute) {
      return (
        <ModulePageHost descriptor={moduleRoute} path={currentPath} search={search} navigate={navigate} onMeta={setModuleMeta} notFound={<NotFound navigate={navigate} />} />
      );
    }
    if (page === undefined) return <div className="min-h-[60vh]" aria-busy="true" />;
    if (!page) return <NotFound navigate={navigate} />;
    return <CmsPageView page={page} selectedBlockId={preview?.selectedBlockId} scrollToBlockId={preview?.scrollToBlockId} scrollNonce={preview?.scrollNonce} />;
  };

  const themePath = previewPost ? `/blog/${previewPost.slug}/` : previewPage?.path ?? currentPath;
  const shell = (
    <ThemeProvider path={themePath} navigate={navigate} openCookies={openCookies}>
      {!IS_PREVIEW && (siteConfig?.settings.analyticsEnabled ?? true) && <SiteAnalytics path={currentPath} />}
      <ThemedShell path={themePath} navigate={navigate} openCookies={openCookies}>
        {renderCurrentView()}
      </ThemedShell>

      {!IS_PREVIEW && (siteConfig?.settings.cookieBannerEnabled ?? true) && (
        <CookieBanner
          isOpen={cookieBannerOpen}
          onClose={() => setCookieBannerOpen(false)}
          onNavigateToCookies={() => {
            setCookieBannerOpen(false);
            navigate('/cookies/');
          }}
        />
      )}

      <ModuleSlotHost name="floating" path={themePath} navigate={navigate} />
    </ThemeProvider>
  );

  const withBanner = (
    <>
      {demoMode && !IS_PREVIEW && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: '#0b1528',
            color: '#fff',
            fontSize: 13,
            padding: '8px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <strong>Démo Snapify</strong> — base CMS restaurée toutes les 24 h ·{' '}
            <a href="/" style={{ color: '#00c6ba' }}>
              Accueil produit
            </a>
          </span>
          <a href="/administrator/login" style={{ color: '#fff', fontWeight: 700 }}>
            Admin démo →
          </a>
        </div>
      )}
      {shell}
    </>
  );

  return IS_PREVIEW ? shell : <MaintenanceGate path={currentPath}>{withBanner}</MaintenanceGate>;
}

/** En-tête, contenu et pied de page fournis par le thème actif. */
function ThemedShell({ path, navigate, openCookies, children }: { path: string; navigate: (p: string) => void; openCookies: () => void; children: React.ReactNode }) {
  const { theme, key, ready } = useActiveTheme();
  if (!ready) return <div className="min-h-screen" aria-busy="true" />;
  const Layout = theme.Layout ?? React.Fragment;
  return (
    <ThemeBoundary key={key} part="mise en page" fallback={children}>
      <Layout>
        <div className="min-h-screen flex flex-col bg-px-surface text-px-navy selection:bg-px-primary/20 selection:text-px-navy">
          <ThemeBoundary part="en-tête">
            <theme.Header path={path} navigate={navigate} openCookies={openCookies} />
          </ThemeBoundary>
          <main className="flex-1">
            <ThemeBoundary key={path} part="contenu">
              {children}
            </ThemeBoundary>
          </main>
          <ThemeBoundary part="pied de page">
            <theme.Footer path={path} navigate={navigate} openCookies={openCookies} />
          </ThemeBoundary>
        </div>
      </Layout>
    </ThemeBoundary>
  );
}

function NotFound({ navigate }: { navigate: (p: string) => void }) {
  const { theme } = useActiveTheme();
  if (theme.NotFound) return <theme.NotFound navigate={navigate} />;
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Page introuvable</h1>
      <button type="button" className="mt-6 underline" onClick={() => navigate('/')}>
        Retour à l’accueil
      </button>
    </div>
  );
}
