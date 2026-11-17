/**
 * Snapify — préfixe public du CMS
 * Sur la plateforme snapify.tn : le site démo vit sous /demo ( / = landing produit ).
 * Sur create-snapify-app (SNAPIFY_DISTRIBUTION=cms) : le site est à la racine /.
 */
declare global {
  interface Window {
    __SNAPIFY_DISTRIBUTION__?: string;
  }
}

function readDistribution(): string {
  if (typeof window === 'undefined') return '';
  return String(window.__SNAPIFY_DISTRIBUTION__ || '').toLowerCase();
}

/** true = install client CMS (pas la démo produit snapify.tn). */
export function isCmsAppClient(): boolean {
  const d = readDistribution();
  return d === 'cms' || d === 'app' || d === 'create-snapify-app';
}

/** Préfixe URL public du CMS. Vide en mode client. */
export function getDemoBase(): string {
  return isCmsAppClient() ? '' : '/demo';
}

/** @deprecated utiliser getDemoBase() — conservé pour imports existants */
export const DEMO_BASE = '/demo';

export function isDemoPath(pathname: string): boolean {
  const base = getDemoBase();
  if (!base) return false;
  return pathname === base || pathname === `${base}/` || pathname.startsWith(`${base}/`);
}

/** Afficher la barre « Démo Snapify » (uniquement plateforme /demo). */
export function showPlatformDemoBanner(pathname: string): boolean {
  if (isCmsAppClient()) return false;
  return isDemoPath(pathname);
}

/** Chemin CMS interne (sans /demo). */
export function toCmsPath(pathname: string): string {
  const base = getDemoBase();
  if (!base || !isDemoPath(pathname)) {
    return pathname.endsWith('/') ? pathname : `${pathname}/`;
  }
  const rest = pathname.slice(base.length) || '/';
  return rest.endsWith('/') ? rest : `${rest}/`;
}

/** Préfixe une route CMS pour l’URL navigateur. */
export function toDemoUrl(cmsPath: string): string {
  const clean = cmsPath.startsWith('/') ? cmsPath : `/${cmsPath}`;
  const base = getDemoBase();
  if (!base) {
    return clean === '/' ? '/' : clean.endsWith('/') ? clean : `${clean}/`;
  }
  if (clean === '/') return `${base}/`;
  return `${base}${clean}`;
}
