/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../security/ip';
import { resolveGeoFromIp } from '../geoip';

/** Paires apex / sous-domaines Tunisie ↔ international. */
const REGION_HOST_PAIRS: Array<[tn: string, fr: string]> = [
  ['snapify.tn', 'snapify.fr'],
  ['www.snapify.tn', 'www.snapify.fr'],
  ['marketplace.snapify.tn', 'marketplace.snapify.fr'],
  ['community.snapify.tn', 'community.snapify.fr'],
  ['developers.snapify.tn', 'developers.snapify.fr'],
];

const TN_TO_FR = new Map(REGION_HOST_PAIRS);
const FR_TO_TN = new Map(REGION_HOST_PAIRS.map(([tn, fr]) => [fr, tn]));

function requestHost(req: Request): string {
  const xf = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const raw = xf || String(req.headers.host || '');
  return raw.split(':')[0].toLowerCase();
}

/** Domaine de cookie plateforme selon le TLD courant (.snapify.tn ou .snapify.fr). */
export function platformCookieDomainForHost(host: string): string | undefined {
  const h = host.toLowerCase();
  if (h === 'snapify.tn' || h.endsWith('.snapify.tn')) return '.snapify.tn';
  if (h === 'snapify.fr' || h.endsWith('.snapify.fr')) return '.snapify.fr';
  const env = process.env.PLATFORM_COOKIE_DOMAIN?.trim();
  return env || undefined;
}

const SEARCH_CRAWLER_RE =
  /googlebot|bingbot|yandex|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|linkedinbot|applebot|semrush|ahrefs|dotbot|mj12bot/i;

function skipGeoRedirect(req: Request): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return true;
  const p = req.path || '';
  if (p.startsWith('/api/') || p.startsWith('/uploads/') || p.startsWith('/assets/') || p.startsWith('/sdk/')) return true;
  if (/\.(js|css|map|ico|png|jpe?g|webp|svg|woff2?|ttf|txt|xml|json)$/i.test(p)) return true;
  // Sitemap / SEO : jamais de redirect géo (évite GSC « Sitemap is HTML » et perte d’index .tn)
  if (
    p === '/sitemap' ||
    p === '/sitemap.xml.gz' ||
    p === '/sitemap_index.xml' ||
    p === '/sitemap-landing.xml' ||
    p === '/robots.txt' ||
    p === '/llms.txt'
  ) {
    return true;
  }
  // Crawlers : laisser indexer .tn et .fr indépendamment (sinon Googlebot US ne voit jamais .tn)
  if (SEARCH_CRAWLER_RE.test(String(req.headers['user-agent'] || ''))) return true;
  // Opt-out ponctuel : ?region=stay
  if (String((req.query as Record<string, unknown>)?.region || '') === 'stay') return true;
  return false;
}

/**
 * Tunisie → *.snapify.tn ; hors Tunisie → *.snapify.fr.
 * 302 (pas 301) pour ne pas figer le géo dans les caches SEO / navigateurs.
 * Jamais pour les crawlers ni les URLs sitemap/robots.
 */
export function geoRegionRedirect(req: Request, res: Response, next: NextFunction): void {
  if (skipGeoRedirect(req)) return next();

  const host = requestHost(req);
  const country = (resolveGeoFromIp(clientIp(req)).country || '').toUpperCase();
  // IP locale / inconnue : laisser le host tel quel
  if (!country) return next();

  const target = country === 'TN' ? FR_TO_TN.get(host) : TN_TO_FR.get(host);
  if (!target) return next();

  const proto = String(req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')).split(',')[0].trim() || 'https';
  const dest = `${proto}://${target}${req.originalUrl || '/'}`;
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, dest);
}
