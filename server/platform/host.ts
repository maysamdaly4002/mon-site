/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type { Request } from 'express';

export type AppHost = 'cms' | 'community' | 'marketplace' | 'developers';

function hostFromReq(req: Request): string {
  const xf = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const raw = xf || String(req.headers.host || '');
  return raw.split(':')[0].toLowerCase();
}

/** Anciens sous-domaines client.* → à rediriger vers /espace-client sur l’apex. */
export function isLegacyClientHost(host: string): boolean {
  const h = host.toLowerCase().split(':')[0];
  const list = (process.env.CLIENT_HOST || 'client.snapify.tn,client.snapify.fr,client.localhost')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(h) || h.startsWith('client.');
}

export function legacyClientRedirectUrl(host: string, originalUrl: string): string {
  const h = host.toLowerCase();
  const apex =
    h.includes('.fr') || h.endsWith('fr')
      ? 'https://snapify.fr'
      : h.includes('localhost')
        ? ''
        : 'https://snapify.tn';
  const [pathPart, ...qs] = (originalUrl || '/').split('?');
  const query = qs.length ? `?${qs.join('?')}` : '';
  let sub = pathPart === '/' ? '' : pathPart;
  if (sub.startsWith('/espace-client')) sub = sub.slice('/espace-client'.length) || '';
  const destPath = `/espace-client${sub}`;
  return apex ? `${apex}${destPath}${query}` : `${destPath}${query}`;
}

export function resolveAppHost(req: Request): AppHost {
  // Dev fallback : ?app=community|marketplace
  const q = String((req.query as Record<string, unknown>)?.app || '');
  if (q === 'community' || q === 'marketplace' || q === 'developers') return q;

  const host = hostFromReq(req);
  const list = (value: string | undefined, fallback: string) => (value || fallback).split(',').map((s) => s.trim().toLowerCase());
  const community = list(
    process.env.COMMUNITY_HOST,
    'community.snapify.tn,community.snapify.fr,community.localhost'
  );
  const marketplace = list(
    process.env.MARKETPLACE_HOST,
    'marketplace.snapify.tn,marketplace.snapify.fr,marketplace.localhost'
  );
  const developers = list(
    process.env.DEVELOPERS_HOST,
    'developers.snapify.tn,developers.snapify.fr,developers.localhost'
  );

  if (community.includes(host)) return 'community';
  if (marketplace.includes(host)) return 'marketplace';
  if (developers.includes(host)) return 'developers';
  return 'cms';
}
