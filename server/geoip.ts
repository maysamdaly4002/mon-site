/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import geoip from 'geoip-lite';

export function resolveGeoFromIp(ip: string): { country?: string; city?: string } {
  const clean = ip.replace(/^::ffff:/, '');
  if (!clean || clean === '127.0.0.1' || clean === '::1') return {};
  const lookup = geoip.lookup(clean);
  if (!lookup) return {};
  return { country: lookup.country, city: lookup.city };
}
