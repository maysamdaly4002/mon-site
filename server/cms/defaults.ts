/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type { CmsSnapshot, MenuConfig, SystemSettings, WidgetArea } from './types';
import { createDefaultRoles } from './permissions';

const now = () => new Date().toISOString();

export function createDefaultMenus(): MenuConfig[] {
  const expertisesChildren = [
    { id: 'm-exp-froid', label: 'Froid commercial & industriel', path: '/expertises/froid/' },
    { id: 'm-exp-recup', label: 'Récupération de chaleur', path: '/expertises/recuperation-de-chaleur/' },
    { id: 'm-exp-cvc', label: 'Chauffage & traitement d\'air', path: '/expertises/chauffage-traitement-air/' },
    { id: 'm-exp-gtb', label: 'GTB / GTC & BACS', path: '/expertises/gtb-gtc/' },
    { id: 'm-exp-iso', label: 'Isolation technique', path: '/expertises/isolation-technique/' },
    { id: 'm-exp-cee', label: 'Réglementation & CEE', path: '/expertises/reglementation-cee/' },
  ];
  const secteursChildren = [
    { id: 'm-sec-ind', label: 'Industrie', path: '/secteurs/industrie/' },
    { id: 'm-sec-ter', label: 'Tertiaire', path: '/secteurs/tertiaire/' },
    { id: 'm-sec-res', label: 'Résidentiel collectif', path: '/secteurs/residentiel-collectif/' },
  ];

  const primary: MenuConfig = {
    id: 'primary',
    label: 'Menu principal (desktop)',
    items: [
      { id: 'm-exp', label: 'Lorem', path: '/expertises/', children: expertisesChildren },
      { id: 'm-sec', label: 'Ipsum', path: '/secteurs/', children: secteursChildren },
      { id: 'm-real', label: 'Réalisations', path: '/realisations/' },
      { id: 'm-approche', label: 'Notre approche', path: '/notre-approche/' },
      { id: 'm-contact', label: 'Lorem ipsum dolor', path: '/contact/', highlight: true },
    ],
  };

  const mobile: MenuConfig = {
    id: 'mobile',
    label: 'Menu mobile',
    items: JSON.parse(JSON.stringify(primary.items)) as MenuConfig['items'],
  };

  const footer: MenuConfig = {
    id: 'footer',
    label: 'Pied de page',
    items: [
      { id: 'f-real', label: 'Réalisations & Chantiers', path: '/realisations/' },
      { id: 'f-approche', label: 'Notre approche (4 étapes)', path: '/notre-approche/' },
      { id: 'f-contact', label: 'Lorem ipsum dolor', path: '/contact/', highlight: true },
      { id: 'f-legal', label: 'Mentions légales', path: '/mentions-legales/' },
      { id: 'f-privacy', label: 'Politique de confidentialité', path: '/politique-de-confidentialite/' },
      { id: 'f-cookies', label: 'Cookies', path: '/cookies/' },
    ],
  };

  const footerCol1: MenuConfig = {
    id: 'footer-col-1',
    label: 'Pied de page · colonne 1',
    items: [
      { id: 'fc1-exp', label: 'Expertises', path: '/expertises/' },
      { id: 'fc1-sec', label: 'Secteurs', path: '/secteurs/' },
      { id: 'fc1-real', label: 'Réalisations', path: '/realisations/' },
    ],
  };

  const footerCol2: MenuConfig = {
    id: 'footer-col-2',
    label: 'Pied de page · colonne 2',
    items: [
      { id: 'fc2-approche', label: 'Notre approche', path: '/notre-approche/' },
      { id: 'fc2-contact', label: 'Contact', path: '/contact/' },
    ],
  };

  const footerCol3: MenuConfig = {
    id: 'footer-col-3',
    label: 'Pied de page · colonne 3',
    items: [
      { id: 'fc3-legal', label: 'Mentions légales', path: '/mentions-legales/' },
      { id: 'fc3-privacy', label: 'Confidentialité', path: '/politique-de-confidentialite/' },
      { id: 'fc3-cookies', label: 'Cookies', path: '/cookies/' },
    ],
  };

  const social: MenuConfig = {
    id: 'social',
    label: 'Réseaux sociaux',
    items: [],
  };

  return [primary, mobile, footer, footerCol1, footerCol2, footerCol3, social];
}

/** Zones de widgets par défaut (pied de page et barre latérale blog). */
export function createDefaultWidgetAreas(): WidgetArea[] {
  return [
    {
      id: 'footer-1',
      label: 'Pied de page · zone 1',
      description: 'Marque et accroche',
      widgets: [
        {
          id: 'w-footer-brand',
          kind: 'text',
          title: '',
          data: {
            body: 'Snapify — Lorem ipsum dolor sit amet, consectetur adipiscing elit. Optimiser aujourd’hui. Performer demain.',
          },
        },
      ],
    },
    {
      id: 'footer-2',
      label: 'Pied de page · zone 2',
      widgets: [{ id: 'w-footer-menu-1', kind: 'menu', title: 'Navigation', data: { menuId: 'footer-col-1' } }],
    },
    {
      id: 'footer-3',
      label: 'Pied de page · zone 3',
      widgets: [{ id: 'w-footer-menu-2', kind: 'menu', title: 'Informations', data: { menuId: 'footer-col-2' } }],
    },
    {
      id: 'footer-4',
      label: 'Pied de page · zone 4',
      widgets: [{ id: 'w-footer-main', kind: 'menu', title: '', data: { menuId: 'footer' } }],
    },
    {
      id: 'sidebar-blog',
      label: 'Barre latérale · blog',
      description: 'Colonne affichée sur les pages du blog',
      widgets: [{ id: 'w-sidebar-recent', kind: 'recent_posts', title: 'Articles récents', data: { limit: 5 } }],
    },
  ];
}

export function createEmptySnapshot(): CmsSnapshot {
  const t = now();
  return {
    version: 1,
    general: {
      legalName: 'Snapify SAS',
      baseline: 'Lorem ipsum dolor sit amet',
      slogan: 'Optimiser aujourd\'hui. Performer demain.',
      phone: '01 41 93 52 80',
      phoneClean: '+33141935280',
      contactEmail: 'contact@snapify.fr',
      slaHours: '48 h ouvrées',
      address: 'Paris & Déploiement partout en France',
      timezone: 'Europe/Paris',
      locale: 'fr-FR',
    },
    branding: {
      siteName: 'Snapify',
      tagline: 'Lorem ipsum dolor sit amet',
      logoUrl: '',
      colors: {
        primary: '#00C6BA',
        primaryHover: '#00A89D',
        accent: '#0066EE',
        navy: '#0B1528',
        background: '#F5F7FA',
        text: '#0B1528',
        muted: '#64748B',
        border: '#E3E8EE',
      },
      fonts: { heading: 'Poppins', body: 'Poppins' },
    },
    pages: [],
    posts: [],
    menus: createDefaultMenus(),
    widgetAreas: createDefaultWidgetAreas(),
    blockPatterns: [],
    forms: [
      {
        id: 'contact-main',
        name: 'Formulaire contact principal',
        recipientEmails: ['contact@snapify.fr'],
        successPath: '/contact/merci/',
        enabled: true,
        honeypotField: 'website_url',
        fields: [
          { id: 'f1', name: 'vousEtes', label: 'Vous êtes', type: 'select', required: true, options: ['Entreprise', 'Collectivité', 'Partenaire CEE', 'Autre'] },
          { id: 'f2', name: 'entreprise', label: 'Entreprise / Organisation', type: 'text', required: true },
          { id: 'f3', name: 'nomPrenom', label: 'Nom & prénom', type: 'text', required: true },
          { id: 'f4', name: 'email', label: 'E-mail', type: 'email', required: true },
          { id: 'f5', name: 'telephone', label: 'Téléphone', type: 'tel', required: true },
          { id: 'f6', name: 'message', label: 'Votre projet', type: 'textarea', required: true },
          { id: 'f7', name: 'rgpdAccepted', label: 'J\'accepte la politique de confidentialité', type: 'checkbox', required: true },
        ],
      },
    ],
    formSubmissions: [],
    floatingButtons: [],
    newsletter: {
      enabled: false,
      provider: 'internal',
      doubleOptIn: true,
    },
    subscribers: [],
    settings: {
      publicUrl:
        (process.env.PUBLIC_URL || process.env.SNAPIFY_PUBLIC_URL || 'https://snapify.fr').replace(/\/$/, ''),
      maintenance: {
        enabled: false,
        title: 'Maintenance en cours',
        message: 'Le site est momentanément indisponible. Merci de votre patience.',
        allowedIps: [],
      },
      cookieBannerEnabled: true,
      analyticsEnabled: true,
      sitemapAuto: true,
      seo: createDefaultSeoGlobal(),
    },
    google: { connected: false },
    media: [],
    redirects: [],
    users: [],
    roles: createDefaultRoles(),
    system: createDefaultSystemSettings(),
  };
}

export function createDefaultSystemSettings(): SystemSettings {
  return {
    smtp: {
      enabled: false,
      host: '',
      port: 587,
      security: 'starttls',
      username: '',
      fromName: 'Snapify',
      fromEmail: '',
      replyTo: '',
      timeoutSec: 20,
      allowSelfSigned: false,
    },
    notifications: { securityAlerts: true, accountChanges: true, adminEmails: [] },
    security: {
      passwordMinLength: 10,
      requireUppercase: false,
      requireNumber: true,
      requireSymbol: false,
      passwordExpiryDays: 0,
      sessionHours: 12,
      rememberDays: 30,
      idleMinutes: 0,
      maxLoginAttempts: 8,
      lockoutMinutes: 15,
      twoFactor: 'optional',
      adminIpAllowlist: [],
      hsts: false,
    },
    limits: {
      publicApiPerMinute: 300,
      adminApiPerMinute: 600,
      formSubmissions: { max: 5, windowMinutes: 10 },
      newsletter: { max: 5, windowMinutes: 10 },
      passwordReset: { max: 5, windowMinutes: 60 },
    },
    uploads: { maxSizeMb: 15, allowImages: true, allowSvg: true, allowVideo: true, allowPdf: true },
    privacy: { analyticsRetentionDays: 400, submissionsRetentionDays: 0, auditRetentionDays: 365, mailLogRetentionDays: 90, storeSubmitterIp: true },
    performance: { publicCacheSeconds: 30 },
  };
}

/** Complète récursivement `value` avec les clés manquantes de `defaults` (les tableaux sont pris tels quels). */
export function withDefaults<T>(defaults: T, value: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(value) ? value : defaults) as T;
  if (defaults && typeof defaults === 'object') {
    const src = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const out: Record<string, unknown> = { ...src };
    for (const [k, d] of Object.entries(defaults as Record<string, unknown>)) out[k] = withDefaults(d, src[k]);
    return out as T;
  }
  return (value === undefined || value === null || typeof value !== typeof defaults ? defaults : value) as T;
}

export function createDefaultSeoGlobal(): import('./types').SeoGlobalSettings {
  return {
    titleSeparator: '|',
    titleSuffix: 'Snapify',
    organizationName: 'Snapify SAS',
    socialProfiles: [],
  };
}

export function defaultSeoForPath(path: string, title: string): import('./types').SeoMeta {
  return {
    focusKeyphrase: '',
    seoTitle: `${title} | Snapify`,
    metaDescription:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    slug: path.replace(/^\/|\/$/g, '') || 'accueil',
    noindex: false,
    nofollow: false,
    twitterCard: 'summary_large_image',
    schemaType: path === '/' ? 'Organization' : 'WebPage',
  };
}

export { now as cmsNow };
