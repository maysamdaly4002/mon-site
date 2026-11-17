/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/** Modèle de données CMS Snapify — source unique pour le site et le backoffice */

import type { BlockKind, BlockStyle, ProjectMeta } from './blocks';
import type { RoleDefinition } from './permissions';

export type BlockType = BlockKind;

export interface CmsBlock {
  id: string;
  type: BlockType;
  data: Record<string, unknown>;
  style?: Partial<BlockStyle>;
}

export interface SeoMeta {
  focusKeyphrase: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  canonicalUrl?: string;
  noindex: boolean;
  nofollow: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard: 'summary' | 'summary_large_image';
  schemaType: 'WebPage' | 'Article' | 'Organization' | 'LocalBusiness';
  breadcrumbsTitle?: string;
}

export type PageContentSource = 'react' | 'cms';
export type PageTemplate = 'default' | 'landing' | 'legal' | 'project';

export interface CmsPage {
  id: string;
  path: string;
  title: string;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: string;
  scheduledAt?: string;
  contentSource: PageContentSource;
  template: PageTemplate;
  blocks: CmsBlock[];
  seo: SeoMeta;
  /** Fiche réalisation (template `project`) : alimente les blocs « Réalisations ». */
  project?: ProjectMeta;
  updatedAt: string;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  children?: MenuItem[];
  openInNewTab?: boolean;
  highlight?: boolean;
}

export interface MenuConfig {
  id: string;
  label: string;
  items: MenuItem[];
}

export type CoreWidgetKind = 'text' | 'html' | 'menu' | 'recent_posts' | 'search';

export interface WidgetInstance {
  id: string;
  kind: CoreWidgetKind | 'module';
  title: string;
  data: Record<string, unknown>;
}

export interface WidgetArea {
  id: string;
  label: string;
  description?: string;
  widgets: WidgetInstance[];
}

export interface BlockPattern {
  id: string;
  name: string;
  description?: string;
  blocks: CmsBlock[];
  createdAt: string;
}

export interface ThemeBranding {
  siteName: string;
  tagline: string;
  logoUrl: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  colors: {
    primary: string;
    primaryHover: string;
    accent: string;
    navy: string;
    background: string;
    text: string;
    muted: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

export interface SiteGeneralInfo {
  legalName: string;
  baseline: string;
  slogan: string;
  phone: string;
  phoneClean: string;
  contactEmail: string;
  slaHours: string;
  address: string;
  timezone: string;
  locale: string;
}

export interface FloatingButtonConfig {
  id: string;
  label: string;
  path: string;
  style: 'primary' | 'outline' | 'ghost';
  enabled: boolean;
}

export interface ContactFormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
  width?: 'full' | 'half';
}

export interface ContactFormConfig {
  id: string;
  name: string;
  recipientEmails: string[];
  successPath: string;
  fields: ContactFormField[];
  honeypotField?: string;
  enabled: boolean;
}

export interface ContactSubmission {
  id: string;
  formId: string;
  payload: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  read: boolean;
}

export interface NewsletterConfig {
  enabled: boolean;
  provider: 'internal' | 'mailchimp' | 'brevo' | 'custom';
  doubleOptIn: boolean;
  welcomeEmailSubject?: string;
  apiKeyEnvVar?: string;
  listId?: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'unsubscribed';
  source?: string;
  confirmToken?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface ContentRevision {
  id: string;
  entityType: 'page' | 'post';
  entityId: string;
  label: string;
  snapshot: CmsPage | BlogPost;
  createdAt: string;
  authorEmail?: string;
}

export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  allowedIps: string[];
  bypassSecret?: string;
}

export interface SeoGlobalSettings {
  titleSeparator: string;
  titleSuffix: string;
  defaultOgImage?: string;
  organizationName: string;
  organizationLogo?: string;
  socialProfiles: string[];
  googleVerification?: string;
  bingVerification?: string;
}

export interface SiteSettings {
  publicUrl: string;
  maintenance: MaintenanceConfig;
  cookieBannerEnabled: boolean;
  analyticsEnabled: boolean;
  robotsTxtExtra?: string;
  sitemapAuto: boolean;
  seo: SeoGlobalSettings;
}

export interface GoogleIntegration {
  connected: boolean;
  searchConsoleProperty?: string;
  analyticsPropertyId?: string;
  /** Chiffré (secrets.ts) ; les anciennes valeurs en clair restent lisibles. */
  oauthRefreshToken?: string;
  /** Identifiants OAuth saisis dans l'administration (prioritaires sur GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). */
  oauthClientId?: string;
  oauthClientSecretEnc?: string;
  /** Compte Google ayant autorisé l'accès. */
  accountEmail?: string;
  lastSyncAt?: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  alt?: string;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  blocks: CmsBlock[];
  seo: SeoMeta;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt?: string;
  scheduledAt?: string;
  author?: string;
  tags: string[];
  updatedAt: string;
  createdAt: string;
}

export interface RedirectRule {
  from: string;
  to: string;
  permanent: boolean;
}

export interface AnalyticsEvent {
  id: string;
  kind: 'view' | 'leave';
  sessionId: string;
  path: string;
  referrer?: string;
  country?: string;
  city?: string;
  device: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  durationSec?: number;
  ts: string;
}

export type UserStatus = 'active' | 'invited' | 'suspended';

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  /** Identifiant d'un rôle de `CmsSnapshot.roles` (`superadmin` = tous les droits). */
  role: string;
  name: string;
  status?: UserStatus;
  title?: string;
  phone?: string;
  /** Photo de profil (/uploads/avatars/…). */
  avatarUrl?: string;
  /** Secret TOTP chiffré (voir server/security/secrets.ts). */
  totpSecret?: string;
  totpEnabled?: boolean;
  /** Empreintes SHA-256 des codes de secours non utilisés. */
  recoveryCodes?: string[];
  mustChangePassword?: boolean;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  loginCount?: number;
  invitedBy?: string;
  createdAt?: string;
}

export interface SmtpSettings {
  /** `false` = utilise la configuration SMTP_* du fichier .env si elle existe. */
  enabled: boolean;
  host: string;
  port: number;
  security: 'starttls' | 'ssl' | 'none';
  username: string;
  /** Mot de passe chiffré ; jamais renvoyé au navigateur. */
  passwordEnc?: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  timeoutSec: number;
  allowSelfSigned: boolean;
}

export interface RateWindow {
  max: number;
  windowMinutes: number;
}

export interface SystemSettings {
  smtp: SmtpSettings;
  notifications: {
    /** Prévient l'utilisateur par e-mail (nouvel appareil, mot de passe ou 2FA modifiés). */
    securityAlerts: boolean;
    /** Prévient les adresses ci-dessous à chaque création ou suppression de compte. */
    accountChanges: boolean;
    adminEmails: string[];
  };
  security: {
    passwordMinLength: number;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
    /** 0 = jamais. */
    passwordExpiryDays: number;
    sessionHours: number;
    rememberDays: number;
    /** Déconnexion après inactivité ; 0 = désactivé. */
    idleMinutes: number;
    maxLoginAttempts: number;
    lockoutMinutes: number;
    twoFactor: 'optional' | 'superadmins' | 'all';
    /** Vide = administration accessible depuis toute adresse. IPv4, IPv6 ou plage CIDR IPv4. */
    adminIpAllowlist: string[];
    hsts: boolean;
  };
  limits: {
    /** Requêtes par minute et par IP sur /api/public ; 0 = illimité. */
    publicApiPerMinute: number;
    /** Requêtes par minute et par utilisateur sur /api/admin ; 0 = illimité. */
    adminApiPerMinute: number;
    formSubmissions: RateWindow;
    newsletter: RateWindow;
    passwordReset: RateWindow;
  };
  uploads: {
    maxSizeMb: number;
    allowImages: boolean;
    allowSvg: boolean;
    allowVideo: boolean;
    allowPdf: boolean;
  };
  privacy: {
    analyticsRetentionDays: number;
    /** 0 = conservés indéfiniment. */
    submissionsRetentionDays: number;
    auditRetentionDays: number;
    mailLogRetentionDays: number;
    storeSubmitterIp: boolean;
  };
  performance: {
    publicCacheSeconds: number;
  };
}

export interface CmsSnapshot {
  version: number;
  general: SiteGeneralInfo;
  branding: ThemeBranding;
  pages: CmsPage[];
  posts: BlogPost[];
  menus: MenuConfig[];
  widgetAreas: WidgetArea[];
  blockPatterns: BlockPattern[];
  forms: ContactFormConfig[];
  formSubmissions: ContactSubmission[];
  floatingButtons: FloatingButtonConfig[];
  newsletter: NewsletterConfig;
  subscribers: NewsletterSubscriber[];
  settings: SiteSettings;
  google: GoogleIntegration;
  media: MediaAsset[];
  redirects: RedirectRule[];
  /** Hérité : les événements sont désormais dans data/cms/analytics.jsonl */
  analyticsEvents?: AnalyticsEvent[];
  users: AdminUser[];
  roles: RoleDefinition[];
  system: SystemSettings;
}

export interface AnalyticsSummary {
  days: number;
  pageViews: number;
  uniqueSessions: number;
  avgTimeOnPageSec: number;
  bounceRate: number;
  activeNow: number;
  timeseries: { date: string; views: number; sessions: number }[];
  topPages: { path: string; views: number; avgTimeSec: number }[];
  countries: { country: string; views: number }[];
  devices: { device: string; views: number }[];
  referrers: { source: string; views: number }[];
  recent: AnalyticsEvent[];
}
