/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
  jsonb,
  timestamp,
  uuid,
  serial,
  index,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { PackagedManifest, Signature, SignedLicense } from '../../sdk/index';
import type {
  AdminUser,
  CmsBlock,
  ContactFormField,
  ContentRevision,
  MenuItem,
  SeoMeta,
} from '../cms/types';
import type { ProjectMeta } from '../cms/blocks';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Réglages « singleton » (infos générales, identité, IA, WhatsApp…) : une ligne par section. */
export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const pages = pgTable(
  'pages',
  {
    id: text('id').primaryKey(),
    path: text('path').notNull(),
    title: text('title').notNull(),
    status: text('status', { enum: ['draft', 'published', 'scheduled'] }).notNull(),
    contentSource: text('content_source', { enum: ['react', 'cms'] }).notNull(),
    template: text('template', { enum: ['default', 'landing', 'legal', 'project'] }).notNull(),
    blocks: jsonb('blocks').$type<CmsBlock[]>().notNull(),
    seo: jsonb('seo').$type<SeoMeta>().notNull(),
    project: jsonb('project').$type<ProjectMeta>(),
    position: integer('position').notNull().default(0),
    publishedAt: ts('published_at'),
    scheduledAt: ts('scheduled_at'),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
  },
  (t) => [uniqueIndex('pages_path_uq').on(t.path), index('pages_status_idx').on(t.status)]
);

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    coverImage: text('cover_image'),
    blocks: jsonb('blocks').$type<CmsBlock[]>().notNull(),
    seo: jsonb('seo').$type<SeoMeta>().notNull(),
    status: text('status', { enum: ['draft', 'published', 'scheduled'] }).notNull(),
    author: text('author'),
    tags: text('tags').array().notNull().default([]),
    publishedAt: ts('published_at'),
    scheduledAt: ts('scheduled_at'),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
  },
  (t) => [uniqueIndex('posts_slug_uq').on(t.slug), index('posts_status_idx').on(t.status, t.publishedAt)]
);

export const revisions = pgTable(
  'revisions',
  {
    id: uuid('id').primaryKey(),
    entityType: text('entity_type', { enum: ['page', 'post'] }).notNull(),
    entityId: text('entity_id').notNull(),
    label: text('label').notNull(),
    snapshot: jsonb('snapshot').$type<ContentRevision['snapshot']>().notNull(),
    authorEmail: text('author_email'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('revisions_entity_idx').on(t.entityType, t.entityId, t.createdAt)]
);

export const menus = pgTable('menus', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  items: jsonb('items').$type<MenuItem[]>().notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const redirects = pgTable(
  'redirects',
  {
    id: serial('id').primaryKey(),
    fromPath: text('from_path').notNull(),
    toPath: text('to_path').notNull(),
    permanent: boolean('permanent').notNull().default(true),
    position: integer('position').notNull().default(0),
  },
  (t) => [uniqueIndex('redirects_from_uq').on(t.fromPath)]
);

export const forms = pgTable('forms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  recipientEmails: text('recipient_emails').array().notNull().default([]),
  successPath: text('success_path').notNull(),
  fields: jsonb('fields').$type<ContactFormField[]>().notNull(),
  honeypotField: text('honeypot_field'),
  enabled: boolean('enabled').notNull().default(true),
  position: integer('position').notNull().default(0),
});

export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: text('id').primaryKey(),
    formId: text('form_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    read: boolean('read').notNull().default(false),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('form_submissions_created_idx').on(t.createdAt), index('form_submissions_form_idx').on(t.formId)]
);

export const subscribers = pgTable(
  'newsletter_subscribers',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    status: text('status', { enum: ['pending', 'active', 'unsubscribed'] }).notNull(),
    source: text('source'),
    confirmToken: text('confirm_token'),
    createdAt: ts('created_at').notNull(),
    confirmedAt: ts('confirmed_at'),
  },
  (t) => [uniqueIndex('subscribers_email_uq').on(t.email), index('subscribers_token_idx').on(t.confirmToken)]
);

export const media = pgTable(
  'media',
  {
    id: text('id').primaryKey(),
    filename: text('filename').notNull(),
    url: text('url').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    alt: text('alt'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('media_created_idx').on(t.createdAt)]
);

export const users = pgTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    salt: text('salt').notNull(),
    status: text('status', { enum: ['active', 'invited', 'suspended'] }).notNull().default('active'),
    title: text('title'),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    totpSecret: text('totp_secret'),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    recoveryCodes: jsonb('recovery_codes').$type<string[]>().notNull().default([]),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    passwordChangedAt: ts('password_changed_at'),
    lastLoginAt: ts('last_login_at'),
    lastLoginIp: text('last_login_ip'),
    loginCount: integer('login_count').notNull().default(0),
    invitedBy: text('invited_by'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('admin_users_email_uq').on(t.email)]
);

/** Sessions d'administration : chaque jeton porte un `sid`, révocable individuellement. */
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    remember: boolean('remember').notNull().default(false),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('admin_sessions_user_idx').on(t.userId), index('admin_sessions_expires_idx').on(t.expiresAt)]
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    ts: ts('ts').notNull().defaultNow(),
    userId: text('user_id'),
    userEmail: text('user_email'),
    action: text('action').notNull(),
    target: text('target'),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('audit_log_ts_idx').on(t.ts), index('audit_log_user_idx').on(t.userId, t.ts), index('audit_log_action_idx').on(t.action)]
);

export const mailLog = pgTable(
  'mail_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    ts: ts('ts').notNull().defaultNow(),
    kind: text('kind').notNull(),
    toAddr: text('to_addr').notNull(),
    subject: text('subject').notNull(),
    status: text('status', { enum: ['sent', 'failed', 'skipped'] }).notNull(),
    error: text('error'),
  },
  (t) => [index('mail_log_ts_idx').on(t.ts)]
);

/** Jetons à usage unique (invitation, réinitialisation) : seule leur empreinte SHA-256 est stockée. */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind', { enum: ['invite', 'reset'] }).notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdBy: text('created_by'),
  },
  (t) => [index('auth_tokens_user_idx').on(t.userId)]
);

/** Modules installés : manifeste et signature conservés pour revérifier l'authenticité à chaque démarrage. */
export const modules = pgTable('modules', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['module', 'theme'] }).notNull().default('module'),
  version: text('version').notNull(),
  /** Thèmes : `true` pour le thème actif (un seul à la fois). */
  enabled: boolean('enabled').notNull().default(true),
  manifest: jsonb('manifest').$type<PackagedManifest>().notNull(),
  signature: jsonb('signature').$type<Signature>(),
  license: jsonb('license').$type<SignedLicense>(),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull(),
  source: text('source', { enum: ['marketplace', 'upload'] }).notNull(),
  installedAt: ts('installed_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const moduleStorage = pgTable(
  'module_storage',
  {
    moduleId: text('module_id').notNull(),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.moduleId, t.key] })]
);

/** Collections d'enregistrements des modules (produits, commandes, clients…). */
export const moduleRecords = pgTable(
  'module_records',
  {
    moduleId: text('module_id').notNull(),
    collection: text('collection').notNull(),
    id: text('id').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.moduleId, t.collection, t.id] }),
    index('module_records_created_idx').on(t.moduleId, t.collection, t.createdAt),
  ]
);

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey(),
    kind: text('kind', { enum: ['view', 'leave'] }).notNull(),
    sessionId: text('session_id').notNull(),
    path: text('path').notNull(),
    referrer: text('referrer'),
    country: text('country'),
    city: text('city'),
    device: text('device', { enum: ['mobile', 'tablet', 'desktop', 'unknown'] }).notNull(),
    durationSec: integer('duration_sec'),
    ts: ts('ts').notNull(),
  },
  (t) => [
    index('analytics_ts_idx').on(t.ts),
    index('analytics_kind_ts_idx').on(t.kind, t.ts),
    index('analytics_session_idx').on(t.sessionId),
  ]
);

/* ---------- Community + Marketplace (plateforme Snapify) ---------- */

export const platformUsers = pgTable(
  'platform_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio').notNull().default(''),
    passwordHash: text('password_hash').notNull(),
    salt: text('salt').notNull(),
    role: text('role', { enum: ['member', 'publisher', 'mod', 'admin'] }).notNull().default('member'),
    emailVerifiedAt: ts('email_verified_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('platform_users_email_uq').on(t.email)]
);

export const platformSessions = pgTable(
  'platform_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('platform_sessions_user_idx').on(t.userId), index('platform_sessions_expires_idx').on(t.expiresAt)]
);

export const platformAuthTokens = pgTable(
  'platform_auth_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind', { enum: ['reset', 'verify'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
  },
  (t) => [index('platform_auth_tokens_user_idx').on(t.userId), uniqueIndex('platform_auth_tokens_hash_uq').on(t.tokenHash)]
);

export const forumCategories = pgTable(
  'forum_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    icon: text('icon').notNull().default('message-circle'),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('forum_categories_slug_uq').on(t.slug)]
);

export const forumTopics = pgTable(
  'forum_topics',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id').notNull(),
    authorId: text('author_id').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    pinned: boolean('pinned').notNull().default(false),
    locked: boolean('locked').notNull().default(false),
    views: integer('views').notNull().default(0),
    lastPostAt: ts('last_post_at').notNull().defaultNow(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('forum_topics_slug_uq').on(t.slug),
    index('forum_topics_category_idx').on(t.categoryId, t.lastPostAt),
    index('forum_topics_author_idx').on(t.authorId),
  ]
);

export const forumPosts = pgTable(
  'forum_posts',
  {
    id: text('id').primaryKey(),
    topicId: text('topic_id').notNull(),
    authorId: text('author_id').notNull(),
    body: text('body').notNull(),
    editedAt: ts('edited_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('forum_posts_topic_idx').on(t.topicId, t.createdAt), index('forum_posts_author_idx').on(t.authorId)]
);

export const forumLikes = pgTable(
  'forum_likes',
  {
    postId: text('post_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

export const forumSubscriptions = pgTable(
  'forum_subscriptions',
  {
    topicId: text('topic_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.userId] })]
);

export const forumNotifications = pgTable(
  'forum_notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    readAt: ts('read_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('forum_notifications_user_idx').on(t.userId, t.createdAt)]
);

export const forumReports = pgTable(
  'forum_reports',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id').notNull(),
    targetType: text('target_type', { enum: ['topic', 'post'] }).notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    status: text('status', { enum: ['open', 'resolved', 'dismissed'] }).notNull().default('open'),
    createdAt: ts('created_at').notNull().defaultNow(),
    resolvedAt: ts('resolved_at'),
  },
  (t) => [index('forum_reports_status_idx').on(t.status, t.createdAt)]
);

export const mpPublishers = pgTable(
  'mp_publishers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    displayName: text('display_name').notNull(),
    website: text('website'),
    payoutIban: text('payout_iban'),
    flouciPaymentId: text('flouci_payment_id'),
    paidAt: ts('paid_at'),
    status: text('status', { enum: ['pending_payment', 'active', 'suspended'] }).notNull().default('pending_payment'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('mp_publishers_user_uq').on(t.userId)]
);

export const mpProducts = pgTable(
  'mp_products',
  {
    id: text('id').primaryKey(),
    publisherId: text('publisher_id').notNull(),
    kind: text('kind', { enum: ['module', 'theme'] }).notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    shortDesc: text('short_desc').notNull().default(''),
    longDesc: text('long_desc').notNull().default(''),
    category: text('category').notNull().default('Autres'),
    priceMillimes: integer('price_millimes').notNull().default(0),
    status: text('status', { enum: ['draft', 'pending', 'published', 'rejected'] }).notNull().default('draft'),
    icon: text('icon').notNull().default('package'),
    screenshots: jsonb('screenshots').$type<string[]>().notNull().default([]),
    engines: jsonb('engines').$type<{ snapify: string }>().notNull().default({ snapify: '^1.0.0' }),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    rejectionReason: text('rejection_reason'),
    salesCount: integer('sales_count').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('mp_products_slug_uq').on(t.slug),
    index('mp_products_status_idx').on(t.status, t.kind),
    index('mp_products_publisher_idx').on(t.publisherId),
  ]
);

export const mpVersions = pgTable(
  'mp_versions',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    version: text('version').notNull(),
    changelog: text('changelog').notNull().default(''),
    packagePath: text('package_path').notNull(),
    sha256: text('sha256').notNull(),
    size: integer('size').notNull().default(0),
    signed: boolean('signed').notNull().default(false),
    validationReport: jsonb('validation_report').$type<Record<string, unknown>>(),
    moduleId: text('module_id'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('mp_versions_product_ver_uq').on(t.productId, t.version), index('mp_versions_product_idx').on(t.productId)]
);

export const mpReviews = pgTable(
  'mp_reviews',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    userId: text('user_id').notNull(),
    rating: integer('rating').notNull(),
    body: text('body').notNull().default(''),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('mp_reviews_product_user_uq').on(t.productId, t.userId), index('mp_reviews_product_idx').on(t.productId)]
);

export const mpOrders = pgTable(
  'mp_orders',
  {
    id: text('id').primaryKey(),
    buyerId: text('buyer_id').notNull(),
    totalMillimes: integer('total_millimes').notNull(),
    commissionMillimes: integer('commission_millimes').notNull().default(0),
    status: text('status', { enum: ['pending', 'paid', 'failed', 'refunded'] }).notNull().default('pending'),
    flouciPaymentId: text('flouci_payment_id'),
    flouciTrackingId: text('flouci_tracking_id'),
    createdAt: ts('created_at').notNull().defaultNow(),
    paidAt: ts('paid_at'),
  },
  (t) => [index('mp_orders_buyer_idx').on(t.buyerId), index('mp_orders_status_idx').on(t.status)]
);

export const mpOrderItems = pgTable(
  'mp_order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull(),
    productId: text('product_id').notNull(),
    versionId: text('version_id').notNull(),
    unitPriceMillimes: integer('unit_price_millimes').notNull(),
    licenseKey: text('license_key').notNull(),
  },
  (t) => [index('mp_order_items_order_idx').on(t.orderId), index('mp_order_items_product_idx').on(t.productId)]
);

export const mpDownloads = pgTable(
  'mp_downloads',
  {
    id: text('id').primaryKey(),
    orderItemId: text('order_item_id').notNull(),
    token: text('token').notNull(),
    expiresAt: ts('expires_at').notNull(),
    count: integer('count').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('mp_downloads_token_uq').on(t.token), index('mp_downloads_item_idx').on(t.orderItemId)]
);

export const mpPayouts = pgTable(
  'mp_payouts',
  {
    id: text('id').primaryKey(),
    publisherId: text('publisher_id').notNull(),
    amountMillimes: integer('amount_millimes').notNull(),
    status: text('status', { enum: ['requested', 'paid', 'rejected'] }).notNull().default('requested'),
    period: text('period').notNull(),
    note: text('note'),
    createdAt: ts('created_at').notNull().defaultNow(),
    paidAt: ts('paid_at'),
  },
  (t) => [index('mp_payouts_publisher_idx').on(t.publisherId, t.status)]
);

export const mpSettings = pgTable('mp_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const mpCarts = pgTable(
  'mp_carts',
  {
    userId: text('user_id').primaryKey(),
    productIds: jsonb('product_ids').$type<string[]>().notNull().default([]),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  }
);

/* ------------------------------------------------------------------ Superadmin SaaS ops */

export const saTickets = pgTable(
  'sa_tickets',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['support', 'payment', 'dev', 'license', 'payout', 'bug'] }).notNull().default('support'),
    status: text('status', { enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] }).notNull().default('open'),
    priority: text('priority', { enum: ['low', 'normal', 'high', 'urgent'] }).notNull().default('normal'),
    subject: text('subject').notNull(),
    body: text('body').notNull().default(''),
    email: text('email'),
    name: text('name'),
    userId: text('user_id'),
    refType: text('ref_type'),
    refId: text('ref_id'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    resolvedAt: ts('resolved_at'),
  },
  (t) => [index('sa_tickets_status_idx').on(t.status, t.kind), index('sa_tickets_user_idx').on(t.userId)]
);

/** Fiche client — créée dès qu’une demande de site / licence est déposée. */
export const clientProfiles = pgTable(
  'client_profiles',
  {
    id: text('id').primaryKey(),
    platformUserId: text('platform_user_id'),
    email: text('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    company: text('company').notNull().default(''),
    domain: text('domain').notNull().default(''),
    market: text('market', { enum: ['tn', 'fr'] }).notNull().default('tn'),
    country: text('country').notNull().default('TN'),
    status: text('status', { enum: ['lead', 'active', 'paused', 'done', 'cancelled'] }).notNull().default('lead'),
    notes: text('notes').notNull().default(''),
    licenseOrderIds: jsonb('license_order_ids').$type<string[]>().notNull().default([]),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('client_profiles_email_uq').on(t.email),
    index('client_profiles_status_idx').on(t.status),
    index('client_profiles_user_idx').on(t.platformUserId),
  ]
);

export const saNewsletterSubscribers = pgTable(
  'sa_newsletter_subscribers',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    source: text('source').notNull().default('manual'),
    status: text('status', { enum: ['active', 'unsubscribed'] }).notNull().default('active'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sa_newsletter_email_uq').on(t.email)]
);

export const saNewsletterCampaigns = pgTable('sa_newsletter_campaigns', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  status: text('status', { enum: ['draft', 'sent'] }).notNull().default('draft'),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentAt: ts('sent_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const saInvoices = pgTable(
  'sa_invoices',
  {
    id: text('id').primaryKey(),
    number: text('number').notNull(),
    kind: text('kind', { enum: ['license', 'marketplace', 'publisher_fee', 'other'] }).notNull(),
    refId: text('ref_id'),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    amountMillimes: integer('amount_millimes').notNull(),
    taxMillimes: integer('tax_millimes').notNull().default(0),
    status: text('status', { enum: ['draft', 'sent', 'paid', 'void'] }).notNull().default('draft'),
    lines: jsonb('lines').$type<{ label: string; amountMillimes: number }[]>().notNull().default([]),
    notes: text('notes').notNull().default(''),
    createdAt: ts('created_at').notNull().defaultNow(),
    sentAt: ts('sent_at'),
    paidAt: ts('paid_at'),
  },
  (t) => [uniqueIndex('sa_invoices_number_uq').on(t.number), index('sa_invoices_status_idx').on(t.status, t.kind)]
);

export const saPaymentEvents = pgTable(
  'sa_payment_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull().default('flouci'),
    kind: text('kind', { enum: ['charge', 'refund', 'fee', 'payout'] }).notNull(),
    amountMillimes: integer('amount_millimes').notNull(),
    status: text('status').notNull(),
    trackingId: text('tracking_id'),
    paymentId: text('payment_id'),
    refType: text('ref_type'),
    refId: text('ref_id'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('sa_payment_events_ref_idx').on(t.refType, t.refId), index('sa_payment_events_created_idx').on(t.createdAt)]
);
