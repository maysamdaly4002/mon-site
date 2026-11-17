/**
 * Snapify — référentiel hébergeurs (formulaire de commande licence)
 * Tunisie : bureaux d'enregistrement .tn accrédités ATI (registre.tn) + hébergeurs locaux.
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */

export type HostingProvider = {
  id: string;
  name: string;
  website?: string;
  group: 'tn' | 'intl' | 'other';
};

const TN: Array<Omit<HostingProvider, 'group'>> = [
  { id: 'ati', name: 'ATI — At-Tounessya Internet', website: 'ati.tn' },
  { id: 'tunisie-telecom', name: 'Tunisie Telecom', website: 'tunisietelecom.tn' },
  { id: 'orange-tn', name: 'Orange Tunisie', website: 'orange.tn' },
  { id: 'ooredoo-tn', name: 'Ooredoo Tunisie', website: 'ooredoo.tn' },
  { id: 'topnet', name: 'Topnet', website: 'topnet.tn' },
  { id: 'globalnet', name: '3S Globalnet', website: 'globalnet.tn' },
  { id: 'hexabyte', name: 'Hexabyte', website: 'hexabyte.tn' },
  { id: 'bee', name: 'BEE — Internet Smart Solutions', website: 'bee.tn' },
  { id: 'tunet', name: 'Tunet', website: 'tunet.tn' },
  { id: 'localhost-tn', name: 'Localhost (cloud.tn)', website: 'cloud.tn' },
  { id: 'atlax', name: 'ATLAX', website: 'atlax.com' },
  { id: 'oxabox', name: 'OXABOX (Tanit Web)', website: 'oxabox.com' },
  { id: 'oxahost', name: 'OxaHost', website: 'oxahost.tn' },
  { id: 'novahoster', name: 'NovaHoster', website: 'novahoster.tn' },
  { id: 'sjr', name: 'SJR', website: 'sjr.tn' },
  { id: 'proxiweb', name: 'Proxiweb', website: 'proxiweb.tn' },
  { id: 'eo-datacenter', name: 'EO Datacenter' },
  { id: 'elb', name: 'ELB' },
  { id: 'vip-domaine', name: 'VIP Domaine' },
  { id: 'cnte', name: 'CNTE' },
  { id: 'safozi', name: 'SAFOZI' },
  { id: 'next-step-it', name: 'Next Step IT' },
  { id: 'dyxis', name: 'Dyxis' },
  { id: 'point-com', name: 'Point Com Développement' },
  { id: 'mind-hosting', name: 'Mind Hosting' },
  { id: 'focus-ts', name: 'Focus Technology Solutions' },
  { id: 'experts-company', name: 'Experts Company' },
];

const INTL: Array<Omit<HostingProvider, 'group'>> = [
  { id: 'ovh', name: 'OVHcloud', website: 'ovhcloud.com' },
  { id: 'hostinger', name: 'Hostinger', website: 'hostinger.fr' },
  { id: 'o2switch', name: 'o2switch', website: 'o2switch.fr' },
  { id: 'lws', name: 'LWS', website: 'lws.fr' },
  { id: 'ionos', name: 'IONOS', website: 'ionos.fr' },
  { id: 'gandi', name: 'Gandi', website: 'gandi.net' },
  { id: 'hetzner', name: 'Hetzner', website: 'hetzner.com' },
  { id: 'contabo', name: 'Contabo', website: 'contabo.com' },
  { id: 'digitalocean', name: 'DigitalOcean', website: 'digitalocean.com' },
  { id: 'aws', name: 'Amazon Web Services (Lightsail / EC2)', website: 'aws.amazon.com' },
  { id: 'gcp', name: 'Google Cloud', website: 'cloud.google.com' },
  { id: 'azure', name: 'Microsoft Azure', website: 'azure.microsoft.com' },
  { id: 'godaddy', name: 'GoDaddy', website: 'godaddy.com' },
  { id: 'namecheap', name: 'Namecheap', website: 'namecheap.com' },
];

const OTHER: Array<Omit<HostingProvider, 'group'>> = [
  { id: 'none', name: 'Pas encore d’hébergement — conseillez-moi' },
  { id: 'other', name: 'Autre hébergeur' },
];

export const HOSTING_PROVIDERS: HostingProvider[] = [
  ...[...TN].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((p) => ({ ...p, group: 'tn' as const })),
  ...[...INTL].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((p) => ({ ...p, group: 'intl' as const })),
  ...OTHER.map((p) => ({ ...p, group: 'other' as const })),
];

export const GOUVERNORATS = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
  'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul',
  'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
];

/** Régions administratives France (marché .fr / intl). */
export const FR_REGIONS = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
  'Guadeloupe',
  'Guyane',
  'Martinique',
  'Mayotte',
  'La Réunion',
  'Autre / UE',
  'International',
];

export const SITE_TYPES = [
  { id: 'vitrine', label: 'Site vitrine' },
  { id: 'boutique', label: 'Boutique en ligne' },
  { id: 'blog', label: 'Blog / média' },
  { id: 'multi', label: 'Multi-sites / agence' },
] as const;

export const HOSTING_TYPES = [
  { id: 'mutualise', label: 'Mutualisé' },
  { id: 'vps', label: 'VPS' },
  { id: 'dedie', label: 'Serveur dédié' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'unknown', label: 'Je ne sais pas' },
] as const;

export const ACCESS_TYPES = [
  { id: 'cpanel', label: 'cPanel' },
  { id: 'plesk', label: 'Plesk' },
  { id: 'directadmin', label: 'DirectAdmin' },
  { id: 'ssh', label: 'SSH / root' },
  { id: 'unknown', label: 'Je ne sais pas' },
] as const;

export function providerById(id: string) {
  return HOSTING_PROVIDERS.find((p) => p.id === id) || null;
}

export function orderFormOptions(market: 'tn' | 'fr' = 'tn') {
  const providers =
    market === 'fr'
      ? HOSTING_PROVIDERS.filter((p) => p.group !== 'tn')
      : HOSTING_PROVIDERS;
  return {
    market,
    regionLabel: market === 'fr' ? 'Région' : 'Gouvernorat',
    providers,
    gouvernorats: market === 'fr' ? FR_REGIONS : GOUVERNORATS,
    siteTypes: SITE_TYPES,
    hostingTypes: HOSTING_TYPES,
    accessTypes: ACCESS_TYPES,
  };
}
