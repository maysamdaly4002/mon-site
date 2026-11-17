/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * SDK des modules Snapify : contrat entre un module et le CMS.
 * Importé par les modules (`@snapify/sdk`) et par l'hôte ; aucune dépendance Node ici,
 * ce fichier est inclus dans les bundles navigateur.
 *
 * Pas d'import `react` ici : Rolldown/Vite SSR peut traiter un `import type` comme une
 * valeur et embarquer React (+ `process.env`) dans `server.mjs`, rejeté par la marketplace.
 */
// Compatible avec React.ComponentType sans dépendre du paquet `react` côté serveur.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentType<P = any> = (props: P) => any;

/** Version de l'API modules et thèmes exposée par ce CMS (contrôlée par `engines.snapify`). */
export const SNAPIFY_MODULE_API_VERSION = '1.3.0';

export const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/* ------------------------------------------------------------------ */
/* Manifeste                                                           */
/* ------------------------------------------------------------------ */

/**
 * Permissions accordées au module, affichées à l'administrateur avant installation.
 * - `site:read`        lecture des informations publiques du site (nom, coordonnées, couleurs)
 * - `storage`          stockage clé/valeur propre au module
 * - `database`         collections d'enregistrements propres au module (produits, commandes…)
 * - `files`            images publiques propres au module (photos de profil…), sous /uploads/modules/<id>/
 * - `http:routes`      exposition de points d'API publics sous /api/modules/<id>/
 * - `http:cookies`     lecture et dépôt de cookies `sm_*` (sessions de visiteurs)
 * - `admin:routes`     points d'API réservés à l'administration (/api/admin/modules/<id>/api/)
 * - `mail:send`        envoi d'e-mails via le serveur SMTP du site
 * - `env:<NOM>`        lecture d'une variable d'environnement serveur précise
 * - `net:<hôte>`       requêtes HTTPS sortantes vers cet hôte uniquement
 * - `net:outbound`     HTTPS/HTTP sortant vers des hôtes publics (anti-SSRF) — migrations, crawlers
 * - `net:ftp`          lecture FTP/FTPS contrôlée via `ctx.ftp` (pas de socket brut dans le module)
 */
export type ModulePermission =
  | 'site:read'
  | 'storage'
  | 'database'
  | 'files'
  | 'http:routes'
  | 'http:cookies'
  | 'admin:routes'
  | 'mail:send'
  | 'net:outbound'
  | 'net:ftp'
  | `env:${string}`
  | `net:${string}`;

export const PERMISSION_PATTERN =
  /^(site:read|storage|database|files|http:routes|http:cookies|admin:routes|mail:send|net:outbound|net:ftp|env:[A-Z][A-Z0-9_]{1,63}|net:[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)$/;

/**
 * Emplacements d'affichage :
 * - `floating`        éléments fixés à l'écran (bulle de chat, bouton WhatsApp…)
 * - `header-actions`  icônes de l'en-tête (panier, compte, recherche), placées par le thème
 */
export type ModuleSlot = 'floating' | 'header-actions';
export const MODULE_SLOTS: readonly ModuleSlot[] = ['floating', 'header-actions'];

/** Adresse publique prise en charge par un module : `/panier/` (exacte) ou `/boutique/*` (sous-pages incluses). */
export const ROUTE_PATTERN_PUBLIC = /^\/([a-z0-9][a-z0-9-]*\/)*(\*)?$/;

/** Widget insérable dans une page via le bloc « Module » de l'éditeur. */
export interface WidgetDefinition {
  /** Identifiant unique dans le module, ex. `products`. */
  id: string;
  label: string;
  description?: string;
  /** Options du widget, saisies dans l'éditeur de pages (mêmes types que les réglages). */
  fields: SettingField[];
}

/** Page ajoutée au menu de l'administration ; son rendu est fourni par l'entrée `admin`. */
export interface AdminPageDefinition {
  id: string;
  label: string;
  /** Icône : mêmes noms que `icon` (ex. `package`, `receipt`, `users`, `ticket`). */
  icon?: string;
}

/** `module` : fonctionnalité (widgets, API) ; `theme` : présentation complète du site. */
export type PackageKind = 'module' | 'theme';
export const SCREENSHOT_FILES = ['screenshot.jpg', 'screenshot.png', 'screenshot.webp'] as const;
export type ScreenshotFile = (typeof SCREENSHOT_FILES)[number];

export type SettingFieldType = 'boolean' | 'text' | 'textarea' | 'number' | 'select' | 'phone' | 'paths';

export interface SettingField {
  key: string;
  type: SettingFieldType;
  label: string;
  help?: string;
  /** Titre de section : les champs consécutifs partageant le même groupe sont regroupés. */
  group?: string;
  default: unknown;
  required?: boolean;
  /** Valeur transmise au navigateur des visiteurs. Par défaut, un réglage reste côté serveur. */
  public?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  rows?: number;
  monospace?: boolean;
  /** Affiche un curseur pour un champ `number`. */
  slider?: boolean;
  options?: { value: string; label: string }[];
}

export interface ModuleManifest {
  /** Identifiant unique « éditeur.module », ex. `novalabs.whatsapp`. */
  id: string;
  /** Absent : `module`. */
  kind?: PackageKind;
  name: string;
  version: string;
  description: string;
  author: { name: string; email?: string; url?: string };
  /** `free` : licence gratuite fournie avec le paquet ; `paid` : clé de licence à saisir. */
  pricing: 'free' | 'paid';
  category?: string;
  /** Nom d'icône Lucide (kebab-case), ex. `message-circle`. */
  icon?: string;
  engines: { snapify: string };
  permissions: ModulePermission[];
  slots: ModuleSlot[];
  settings: SettingField[];
  /** Fichiers sources (manifeste de développement) ou bundles (manifeste empaqueté). */
  entries: { public?: string; server?: string; admin?: string };
  /** Thèmes : capture d'écran 4:3 (JPEG, PNG ou WebP) présentée dans l'administration. */
  screenshot?: string;
  /** Adresses du site affichées par le module (composant `page`), ex. `/boutique/*`. */
  routes?: string[];
  /** Widgets proposés dans le bloc « Module » de l'éditeur de pages. */
  widgets?: WidgetDefinition[];
  /** Pages d'administration (composants de l'entrée `admin`). */
  adminPages?: AdminPageDefinition[];
  /** Modules indispensables et version attendue : sans eux, ce module reste bloqué. */
  requires?: Record<string, string>;
  /** Modules facultatifs dont ce module utilise les services s'ils sont actifs. */
  uses?: string[];
}

export const packageKind = (m: Pick<ModuleManifest, 'kind'>): PackageKind => (m.kind === 'theme' ? 'theme' : 'module');

/** Manifeste tel qu'il figure dans un paquet : entrées compilées + empreinte de chaque fichier. */
export interface PackagedManifest extends ModuleManifest {
  entries: { public?: 'public.js'; server?: 'server.mjs'; admin?: 'admin.js' };
  styles?: 'public.css';
  adminStyles?: 'admin.css';
  screenshot?: ScreenshotFile;
  files: Record<string, { sha256: string; size: number }>;
  builtAt: string;
}

/* ------------------------------------------------------------------ */
/* Côté navigateur                                                     */
/* ------------------------------------------------------------------ */

export interface PublicSiteInfo {
  name: string;
  legalName: string;
  phone: string;
  phoneClean: string;
  email: string;
  slaHours: string;
  address: string;
}

export interface PublicModuleProps<S = Record<string, unknown>> {
  /** Réglages marqués `public: true` uniquement. */
  settings: S;
  site: PublicSiteInfo;
  path: string;
  /** Aperçu de l'éditeur de pages : les widgets interactifs peuvent choisir de se masquer. */
  isPreview: boolean;
  navigate: (path: string) => void;
  /** Appels vers les routes déclarées par le module (`/api/modules/<id>/…`). */
  api: ModuleApi;
  module: { id: string; version: string };
}

export interface ModuleApi {
  get: <T = unknown>(path: string) => Promise<T>;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}

/** Page affichée pour une adresse déclarée dans `routes`, entre l'en-tête et le pied de page du thème. */
export interface PublicPageProps<S = Record<string, unknown>> extends PublicModuleProps<S> {
  /** Paramètres de l'adresse (`?page=2&tri=prix`), chaîne vide sinon. `navigate('/boutique/?page=2')` les modifie. */
  search: string;
  /** Titre de l'onglet et description pour les moteurs de recherche. */
  setMeta: (meta: { title?: string; description?: string }) => void;
}

/** Widget inséré dans une page par le bloc « Module ». */
export interface WidgetProps<S = Record<string, unknown>, O = Record<string, unknown>> extends PublicModuleProps<S> {
  widget: string;
  /** Options saisies dans l'éditeur, complétées par les valeurs par défaut. */
  options: O;
}

export interface PublicModule<S = Record<string, unknown>> {
  slots?: Partial<Record<ModuleSlot, ComponentType<PublicModuleProps<S>>>>;
  page?: ComponentType<PublicPageProps<S>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  widgets?: Record<string, ComponentType<WidgetProps<S, any>>>;
}

export function definePublicModule<S = Record<string, unknown>>(mod: PublicModule<S>): PublicModule<S> {
  return mod;
}

/** Client des routes publiques d'un module (le sien ou celui d'un autre module actif). */
export function createModuleApi(id: string): ModuleApi {
  const call = async <T,>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`/api/modules/${id}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.error || `Erreur ${res.status}`), { status: res.status, fields: data?.fields });
    return data as T;
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}) };
}

/** Modules actifs sur le site (identifiants), fournis par l'hôte. */
export function isModuleActive(id: string): boolean {
  const rt = (globalThis as { __SNAPIFY_RUNTIME__?: { activeModules?: string[] } }).__SNAPIFY_RUNTIME__;
  return !!rt?.activeModules?.includes(id);
}

/**
 * Liste vide = toutes les pages. Une adresse terminée par `*` inclut ses sous-pages
 * (`/blog/*`), sinon la correspondance est exacte, au slash final près.
 */
export function matchesPaths(patterns: string[] | undefined, path: string): boolean {
  if (!patterns || patterns.length === 0) return true;
  const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`);
  return patterns.some((pat) => (pat.endsWith('*') ? norm(path).startsWith(pat.slice(0, -1)) : norm(pat) === norm(path)));
}

/** Erreur renvoyée par `api.get/post` : `status` HTTP et message de l'API. */
export interface ModuleApiError extends Error {
  status: number;
}

/* ------------------------------------------------------------------ */
/* Côté serveur                                                        */
/* ------------------------------------------------------------------ */

export type ModuleHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ModuleRequest {
  method: ModuleHttpMethod;
  path: string;
  /** Segments variables de la route (`/products/:id` → `params.id`). */
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  ip: string;
  userAgent: string;
  /** `http:cookies` — cookies `sm_*` uniquement. */
  cookies: Record<string, string>;
  /** Routes d'administration : utilisateur connecté. */
  admin?: { id: string; email: string; name: string };
}

export type ModuleRouteHandler = (req: ModuleRequest) => unknown | Promise<unknown>;

/** Cookie déposé par une réponse : toujours HttpOnly, SameSite=Lax, Path=/ (Secure en HTTPS). */
export interface ModuleCookie {
  /** Doit commencer par `sm_`, ex. `sm_session`. */
  name: string;
  value: string;
  /** Durée de vie en secondes ; 0 supprime le cookie ; absent = cookie de session. */
  maxAgeSec?: number;
}

export interface ModuleReply {
  readonly __snapifyReply: true;
  body: unknown;
  status: number;
  cookies: ModuleCookie[];
}

/* -------- Collections (`database`) -------- */

export interface RecordMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type StoredRecord<T> = T & RecordMeta;

export type FilterOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists';

/** `field` : champ de premier niveau, ou `id`, `createdAt`, `updatedAt`. */
export interface RecordFilter {
  field: string;
  op: FilterOp;
  value?: unknown;
}

export interface FindQuery {
  /** Égalités simples sur des champs de premier niveau (un tableau doit contenir les valeurs données). */
  where?: Record<string, unknown>;
  filters?: RecordFilter[];
  /** Recherche insensible à la casse et aux accents dans ces champs texte. */
  search?: { fields: string[]; text: string };
  orderBy?: { field: string; dir?: 'asc' | 'desc'; numeric?: boolean }[];
  /** 500 maximum (100 par défaut). */
  limit?: number;
  offset?: number;
}

export interface Collection<T> {
  get: (id: string) => Promise<StoredRecord<T> | null>;
  getMany: (ids: string[]) => Promise<StoredRecord<T>[]>;
  find: (q?: FindQuery) => Promise<{ items: StoredRecord<T>[]; total: number }>;
  findOne: (where: Record<string, unknown>) => Promise<StoredRecord<T> | null>;
  count: (q?: Pick<FindQuery, 'where' | 'filters' | 'search'>) => Promise<number>;
  /** `id` facultatif : un identifiant aléatoire est généré. */
  insert: (data: T, opts?: { id?: string }) => Promise<StoredRecord<T>>;
  /** Fusion superficielle ; `null` si l'enregistrement n'existe pas. */
  update: (id: string, patch: Partial<T>) => Promise<StoredRecord<T> | null>;
  delete: (id: string) => Promise<boolean>;
}

export interface ModuleStatusReport {
  stats?: { label: string; value: string | number; hint?: string }[];
  alerts?: { tone: 'info' | 'warning' | 'danger' | 'success'; title?: string; text: string }[];
}

export interface ServerSiteInfo extends PublicSiteInfo {
  publicUrl: string;
  colors: Record<string, string>;
}

export interface ModuleLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Capacités offertes au module. Chaque méthode vérifie la permission correspondante
 * déclarée dans le manifeste ; un appel non autorisé lève une erreur.
 */
export interface ServerContext<S = Record<string, unknown>> {
  module: { id: string; version: string };
  /** Réglages complets (publics et serveur), validés selon le manifeste. */
  settings: () => S;
  log: ModuleLogger;
  /**
   * `http:routes` — chemins relatifs à /api/modules/<id>, segments variables `:nom` acceptés.
   * Le retour est sérialisé en JSON ; `reply()` permet de choisir le statut et de déposer des cookies.
   */
  http: {
    get: (path: string, handler: ModuleRouteHandler) => void;
    post: (path: string, handler: ModuleRouteHandler) => void;
    /** `http:cookies` pour déposer des cookies. */
    reply: (body: unknown, opts?: { status?: number; cookies?: ModuleCookie[] }) => ModuleReply;
  };
  /** `database` — collections d'enregistrements JSON (256 Ko max. par enregistrement). */
  db: {
    collection: <T = Record<string, unknown>>(name: string) => Collection<T>;
  };
  /** Exécute `fn` sans concurrence pour une même clé (stock, numérotation…). */
  lock: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
  /** `mail:send` — via le SMTP configuré dans les paramètres ; n'échoue jamais (voir `sent`). */
  mail: {
    send: (msg: { to: string | string[]; subject: string; html: string; text?: string; replyTo?: string }) => Promise<{ sent: boolean; reason?: string }>;
    /** Gabarit aux couleurs du site. */
    render: (content: { title: string; intro: string; lines?: string[]; button?: { label: string; url: string }; outro?: string; html?: string }) => { html: string; text: string };
  };
  /** Publie les services de ce module pour les modules qui le déclarent dans `requires` ou `uses`. */
  provide: (services: object) => void;
  /** Services d'un module déclaré dans `requires` ou `uses` ; `null` s'il n'est pas actif. */
  use: <T = Record<string, unknown>>(moduleId: string) => T | null;
  /** Construit une erreur dont le statut et le message sont renvoyés tels quels au client. */
  error: (status: number, message: string) => Error;
  /** `env:<NOM>` */
  env: (name: string) => string | undefined;
  /**
   * `net:<hôte>` — HTTPS vers cet hôte, 30 s.
   * `net:outbound` — HTTP/HTTPS vers un hôte public (anti-SSRF, redirections limitées).
   */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /**
   * `net:ftp` — lit des fichiers texte via FTP/FTPS (exports SEO, .htaccess…).
   * Identifiants jamais journalisés ; à purger après usage côté module.
   */
  ftp: {
    list: (opts: {
      host: string;
      port?: number;
      user: string;
      password: string;
      secure?: boolean;
      path?: string;
    }) => Promise<string[]>;
    readText: (opts: {
      host: string;
      port?: number;
      user: string;
      password: string;
      secure?: boolean;
      path: string;
      maxBytes?: number;
    }) => Promise<string>;
  };
  /** `site:read` */
  site: () => ServerSiteInfo;
  /**
   * `files` (API 1.3) — images JPG, PNG ou WebP envoyées en base64 (voir `prepareAvatar` de
   * `@snapify/sdk/image`), contrôlées puis servies publiquement. 2 Mo maximum par image.
   */
  files: {
    /** Enregistre l'image et renvoie son URL publique (/uploads/modules/<id>/…). */
    saveImage: (image: { dataBase64: string; mimeType: string }, opts?: { prefix?: string; maxBytes?: number }) => Promise<string>;
    /** Supprime une image de ce module ; les autres URL sont ignorées. */
    delete: (url: string | undefined | null) => Promise<void>;
  };
  /** `storage` — valeurs JSON de 64 Ko maximum. */
  storage: {
    get: <T = unknown>(key: string) => Promise<T | undefined>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  /**
   * Administration : indicateurs de la page du module et, avec `admin:routes`, routes réservées
   * aux utilisateurs autorisés à gérer les données des modules (/api/admin/modules/<id>/api/…).
   */
  admin: {
    status: (provider: () => ModuleStatusReport | Promise<ModuleStatusReport>) => void;
    get: (path: string, handler: ModuleRouteHandler) => void;
    post: (path: string, handler: ModuleRouteHandler) => void;
    put: (path: string, handler: ModuleRouteHandler) => void;
    delete: (path: string, handler: ModuleRouteHandler) => void;
  };
}

export interface ServerModule<S = Record<string, unknown>> {
  /** Appelé à l'activation ; la fonction renvoyée est appelée à la désactivation. */
  activate: (ctx: ServerContext<S>) => void | (() => void) | Promise<void | (() => void)>;
}

export function defineServerModule<S = Record<string, unknown>>(mod: ServerModule<S>): ServerModule<S> {
  return mod;
}

/* ------------------------------------------------------------------ */
/* Licences                                                            */
/* ------------------------------------------------------------------ */

export interface LicensePayload {
  v: 1;
  licenseId: string;
  moduleId: string;
  licensee: string;
  plan: 'free' | 'standard' | 'pro' | 'enterprise';
  /** Domaines autorisés : `*` (tous), `exemple.fr`, `*.exemple.fr`. */
  domains: string[];
  issuedAt: string;
  expiresAt: string | null;
}

export interface Signature {
  alg: 'ed25519';
  kid: string;
  value: string;
}

export interface SignedLicense {
  payload: LicensePayload;
  signature: Signature;
}

/**
 * reCAPTCHA : importer depuis `@snapify/sdk/recaptcha` (pas depuis l’entrée principale).
 * Un re-export ici forçait React dans tous les `server.mjs` (Rolldown ne tree-shake pas
 * correctement ce barrel), ce que la marketplace refuse (`process.env` / import externe).
 */

export const LICENSE_KEY_PREFIX = 'SNAPIFY-LIC-';
