/**
 * Affichage monétaire marketplace / plateforme.
 * Source de vérité = millimes DT ; hors Tunisie → conversion affichage en EUR.
 * Aligné landing : ~699 DT ≈ 99 € → 7 DT = 1 €.
 */
export const DT_PER_EUR = 7;

export function isTunisiaCountry(country?: string | null): boolean {
  return (country || '').trim().toUpperCase() === 'TN';
}

export function formatDt(millimes: number): string {
  const n = Math.max(0, Number(millimes) || 0);
  return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 3)} DT`;
}

export function formatEurFromMillimes(millimes: number): string {
  const n = Math.max(0, Number(millimes) || 0);
  const eur = n / 1000 / DT_PER_EUR;
  const rounded = Math.round(eur * 100) / 100;
  return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 2).replace('.', ',')} €`;
}

/** Gratuit reste « Gratuit » ; sinon DT (TN) ou € (reste du monde). */
export function formatMoney(millimes: number, country?: string | null): string {
  const n = Math.max(0, Number(millimes) || 0);
  if (n === 0) return 'Gratuit';
  return isTunisiaCountry(country) ? formatDt(n) : formatEurFromMillimes(n);
}

export function moneyCurrency(country?: string | null): 'TND' | 'EUR' {
  return isTunisiaCountry(country) ? 'TND' : 'EUR';
}

export function countryFromRequest(req: { headers: Record<string, unknown>; ip?: string }, clientIpFn: (req: unknown) => string, resolveGeo: (ip: string) => { country?: string | null }): string {
  try {
    const geo = resolveGeo(clientIpFn(req));
    return (geo.country || '').toUpperCase();
  } catch {
    return '';
  }
}
