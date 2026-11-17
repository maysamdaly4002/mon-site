/**
 * WP SEO Migrator — schéma normalisé + contrat connecteur
 * © 2026 Hamdi Ayari / NOVALABS
 */

export type SeoField =
  | 'url'
  | 'slug'
  | 'status'
  | 'seoTitle'
  | 'metaDescription'
  | 'focusKeyphrase'
  | 'canonicalUrl'
  | 'noindex'
  | 'nofollow'
  | 'ogTitle'
  | 'ogDescription'
  | 'ogImage'
  | 'twitterCard'
  | 'schemaType'
  | 'schemaJsonLd'
  | 'hreflang'
  | 'breadcrumbsTitle'
  | 'imageAlts'
  | 'redirects';

export type ContentKind = 'page' | 'post' | 'product' | 'term' | 'other';

export interface SeoRecord {
  id: string;
  kind: ContentKind;
  url: string;
  path: string;
  slug: string;
  status: 'publish' | 'draft' | 'private' | 'other';
  title?: string;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyphrase?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  schemaType?: string;
  schemaJsonLd?: string;
  hreflang?: { lang: string; url: string }[];
  breadcrumbsTitle?: string;
  imageAlts?: { src: string; alt: string }[];
  /** Provenance par champ */
  sources: Partial<Record<SeoField, string>>;
}

export interface RedirectRecord {
  id: string;
  from: string;
  to: string;
  permanent: boolean;
  source: string;
}

export interface ConnectorDetect {
  id: string;
  name: string;
  found: boolean;
  detail?: string;
}

export interface ExtractResult {
  records: SeoRecord[];
  redirects: RedirectRecord[];
  warnings: string[];
}

export interface SeoConnector {
  id: string;
  name: string;
  fields: SeoField[];
  /** Détection à partir du payload d’analyse (fichiers / meta). */
  detect: (ctx: AnalyzeContext) => ConnectorDetect;
  extract: (ctx: AnalyzeContext) => ExtractResult | Promise<ExtractResult>;
}

export interface UploadedFile {
  name: string;
  mimeType: string;
  /** Texte UTF-8 ou base64 selon encoding */
  content: string;
  encoding: 'utf8' | 'base64';
}

export interface AnalyzeContext {
  siteUrl?: string;
  files: UploadedFile[];
  textFiles: { name: string; text: string }[];
}

export interface CoverageIssue {
  id: string;
  severity: 'info' | 'warn' | 'fix';
  message: string;
  /** Action proposée (bouton UI) */
  action?: { id: string; label: string };
  count?: number;
}

export interface MigrationStats {
  pages: number;
  posts: number;
  products: number;
  terms: number;
  redirects: number;
  withTitle: number;
  withDesc: number;
  withCanonical: number;
  withOg: number;
  coveragePct: number;
}

export interface MigrationJob {
  id: string;
  status: 'draft' | 'analyzing' | 'ready' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
  siteUrl: string;
  createdAt: string;
  updatedAt: string;
  connectors: ConnectorDetect[];
  stats: MigrationStats;
  issues: CoverageIssue[];
  preview: { before: Partial<SeoRecord>; after: Partial<SeoRecord> }[];
  progress: { total: number; done: number; errors: number; message: string };
  apply: {
    updateSeo: boolean;
    addRedirects: boolean;
    createMissingDrafts: boolean;
  };
  report?: {
    migrated: number;
    redirectsAdded: number;
    missing: number;
    errors: string[];
    dnsChecklist: string[];
  };
}

export interface Settings {
  uiLang: 'fr' | 'en' | 'ar';
  watchDays: number;
  notifyEmail: string;
}
