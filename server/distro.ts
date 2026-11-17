/**
 * Mode de distribution Snapify.
 * - platform (défaut) : snapify.tn / .fr — landing, marketplace, community, superadmin
 * - cms : paquet create-snapify-app — site client + backoffice uniquement
 */
export type SnapifyDistribution = 'platform' | 'cms';

export function snapifyDistribution(): SnapifyDistribution {
  const v = String(process.env.SNAPIFY_DISTRIBUTION || process.env.SNAPIFY_DISTRO || 'platform')
    .trim()
    .toLowerCase();
  if (v === 'cms' || v === 'app' || v === 'create-snapify-app') return 'cms';
  return 'platform';
}

export function isCmsAppDistro(): boolean {
  return snapifyDistribution() === 'cms';
}

/** Données de démonstration (pages, contenus) au premier boot. */
export function wantDemoContent(): boolean {
  const v = String(process.env.SEED_DEMO || process.env.DEMO_CONTENT || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'o' || v === 'oui';
}
