/** Dates métier = chaînes AAAA-MM-JJ (UTC), jamais d'objet Date partagé : pas de piège de fuseau horaire. */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDay(new Date(`${s}T00:00:00Z`)) === s;

/** Ajoute des mois en conservant le jour, ramené au dernier jour du mois si besoin (31 janv. + 1 mois = 28/29 févr.). */
export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = m - 1 + n;
  const ny = y + Math.floor(t / 12);
  const nm = ((t % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
/** Lundi de la semaine du jour donné (clé des rappels hebdomadaires). */
export const weekStart = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
