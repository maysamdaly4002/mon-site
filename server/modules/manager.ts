/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Gestionnaire des modules : installation, vérifications (signature NOVALABS, licence,
 * intégrité des fichiers, compatibilité) et cycle de vie du code serveur.
 *
 * Modèle de sécurité : seul un paquet signé par une clé de `trust.ts` s'installe (sauf mode
 * développeur). Le manifeste signé liste l'empreinte de chaque fichier ; elles sont revérifiées
 * au démarrage et avant chaque chargement. Le code serveur d'un module s'exécute dans le
 * processus du CMS et n'obtient que les capacités du contexte, filtrées par ses permissions.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import * as t from '../db/schema';
import { getDataPaths, loadSnapshot } from '../cms/store';
import type { CmsSnapshot } from '../cms/types';
import { decodeImage, ImageError, removeImage, saveImage } from '../media/images';
import {
  packageKind,
  SCREENSHOT_FILES,
  SNAPIFY_MODULE_API_VERSION,
  type ModuleCookie,
  type ModuleHttpMethod,
  type ModuleReply,
  type ModuleRequest,
  type ModuleRouteHandler,
  type ModuleStatusReport,
  type PackagedManifest,
  type ServerContext,
  type ServerModule,
  type Signature,
  type SignedLicense,
} from '../../sdk/index';
import { renderEmail, sendMail } from '../mail';
import { createCollection, deleteModuleRecords } from './records';
import { checkLicensePayload, decodeLicenseKey, decodePackage, domainAllowed, PackageError, satisfies, sha256, verify, compareVersions } from '../../sdk/package';
import { publicSettings, validateSettings } from '../../sdk/settings';
import { TRUSTED_KEYS } from './trust';
import { LEGACY_KEYS, OFFICIAL_MODULES } from './legacy';
import { localPackage } from './marketplace';
import type {
  InstalledModuleDetail,
  InstalledModuleInfo,
  InstalledThemeDetail,
  InstalledThemeInfo,
  ModuleLicenseInfo,
  ModuleSignatureInfo,
  ModuleStatusCode,
  PublicModuleDescriptor,
  PublicThemeDescriptor,
  StagedPackageInfo,
} from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(__dirname, '../../data/modules');
const BOOTSTRAP_KEY = 'modules.bootstrap';
const THEMES_BOOTSTRAP_KEY = 'themes.bootstrap';
/** Thème par défaut : installé au premier démarrage et utilisé en secours si le thème actif est bloqué. */
export const DEFAULT_THEME_ID = 'novalabs.sidibou';
const STAGE_TTL_MS = 15 * 60 * 1000;
const ACTIVATE_TIMEOUT_MS = 10_000;
/** Routes admin modules (génération IA, pipelines…) — au-delà → « délai dépassé ». */
const HANDLER_TIMEOUT_MS = 120_000;
const STORAGE_MAX_VALUE = 64 * 1024;
const FILES_MAX_BYTES = 2 * 1024 * 1024;
const STORAGE_MAX_KEYS = 1000;
const RATE_LIMIT_PER_MIN = 120;
const PUBLIC_ASSETS: readonly string[] = ['public.js', 'public.css', 'admin.js', 'admin.css', ...SCREENSHOT_FILES];
const ADMIN_ASSETS: readonly string[] = ['admin.js', 'admin.css'];

export const isDevMode = () => process.env.SNAPIFY_MODULES_DEV_MODE === 'true';

type Row = typeof t.modules.$inferSelect;

interface RouteEntry {
  method: ModuleHttpMethod;
  segments: string[];
  handler: ModuleRouteHandler;
}

interface Runtime {
  routes: RouteEntry[];
  adminRoutes: RouteEntry[];
  services: object | null;
  status?: () => ModuleStatusReport | Promise<ModuleStatusReport>;
  deactivate?: () => void;
}

interface ModuleState {
  row: Row;
  signature: ModuleSignatureInfo;
  licenseSignatureValid: boolean;
  integrity: 'ok' | 'tampered';
  assets: Map<string, Buffer>;
  runtime: Runtime | null;
  runtimeError: string | null;
}

export class ModuleError extends PackageError {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const states = new Map<string, ModuleState>();
let site: CmsSnapshot | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Les opérations d'installation et de configuration sont sérialisées. */
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

const moduleDir = (id: string, version: string) => path.join(MODULES_DIR, id, version);
const isTheme = (s: ModuleState) => s.row.kind === 'theme';

async function refreshSite() {
  site = await loadSnapshot();
}

function siteHost(): string {
  try {
    return new URL(site?.settings.publicUrl || 'http://localhost').hostname;
  } catch {
    return 'localhost';
  }
}

/* ------------------------------------------------------------------ */
/* Vérifications                                                       */
/* ------------------------------------------------------------------ */

function signatureInfo(manifest: PackagedManifest, signature: Signature | null | undefined): ModuleSignatureInfo {
  const valid = verify(manifest, signature ?? undefined, TRUSTED_KEYS);
  return { valid, kid: valid ? signature!.kid : undefined, devUnsigned: !valid && !signature && isDevMode() };
}

function evaluateLicense(
  moduleId: string,
  pricing: PackagedManifest['pricing'],
  license: SignedLicense | null | undefined,
  licenseSignatureValid: boolean,
  sig: ModuleSignatureInfo
): ModuleLicenseInfo {
  if (!license) {
    if (sig.devUnsigned) return { state: 'dev', message: 'Mode développeur : licence non vérifiée' };
    return { state: 'missing', message: pricing === 'paid' ? 'Clé de licence requise pour activer ce module' : 'Licence absente du paquet' };
  }
  const p = license.payload;
  if (!licenseSignatureValid || checkLicensePayload(p).length || p.moduleId !== moduleId) {
    return { state: 'invalid', message: 'Licence invalide ou non émise par NOVALABS' };
  }
  const base = { licenseId: p.licenseId, licensee: p.licensee, plan: p.plan, domains: p.domains, expiresAt: p.expiresAt };
  if (p.expiresAt && Date.parse(p.expiresAt) < Date.now()) {
    return { ...base, state: 'expired', message: `Licence expirée le ${new Date(p.expiresAt).toLocaleDateString('fr-FR')}` };
  }
  const host = siteHost();
  if (!domainAllowed(p.domains, host)) return { ...base, state: 'domain', message: `Licence non valable pour le domaine ${host}` };
  return { ...base, state: 'valid', message: p.plan === 'free' ? 'Licence gratuite' : `Licence ${p.plan}` };
}

const licenseOf = (s: ModuleState) => evaluateLicense(s.row.id, s.row.manifest.pricing, s.row.license, s.licenseSignatureValid, s.signature);

/** Statut hors erreur d'exécution : `active` signifie que le module peut fonctionner. */
function gateStatus(s: ModuleState, depth = 0): { code: ModuleStatusCode; message: string } {
  if (!s.signature.valid && !s.signature.devUnsigned) {
    return { code: 'unsigned', message: 'Signature absente ou invalide : module bloqué' };
  }
  if (s.integrity === 'tampered') return { code: 'tampered', message: 'Fichiers modifiés ou manquants depuis l’installation : module bloqué' };
  if (!satisfies(SNAPIFY_MODULE_API_VERSION, s.row.manifest.engines.snapify)) {
    return { code: 'incompatible', message: `Nécessite Snapify ${s.row.manifest.engines.snapify}` };
  }
  const lic = licenseOf(s);
  if (lic.state !== 'valid' && lic.state !== 'dev') return { code: `license_${lic.state}` as ModuleStatusCode, message: lic.message };
  if (!s.row.enabled) return { code: 'disabled', message: isTheme(s) ? 'Thème inactif' : 'Module désactivé' };
  const missing = missingDependency(s, depth);
  if (missing) return { code: 'dependency', message: missing };
  return { code: 'active', message: s.signature.devUnsigned ? 'Actif (non signé, mode développeur)' : 'Actif' };
}

/** Première dépendance non satisfaite (absente, inactive ou de version incompatible), sinon `null`. */
function missingDependency(s: ModuleState, depth: number): string | null {
  for (const [id, range] of Object.entries(s.row.manifest.requires ?? {})) {
    const dep = states.get(id);
    const name = dep?.row.manifest.name ?? id;
    if (!dep || isTheme(dep)) return `Nécessite le module « ${name} » (${range}) : installez-le depuis la marketplace.`;
    if (!satisfies(dep.row.version, range)) return `Nécessite « ${name} » ${range} (version installée : ${dep.row.version}).`;
    if (depth > 5 || gateStatus(dep, depth + 1).code !== 'active') return `Nécessite le module « ${name} », actuellement inactif.`;
  }
  return null;
}

/** Vérifications passées (signature, intégrité, compatibilité, licence), qu'il soit activé ou non. */
function usable(s: ModuleState): boolean {
  const code = gateStatus(s).code;
  return code === 'active' || code === 'disabled' || code === 'dependency';
}

function statusOf(s: ModuleState) {
  const gate = gateStatus(s);
  if (gate.code === 'active' && s.runtimeError) return { code: 'error' as const, message: s.runtimeError };
  return gate;
}

async function loadState(row: Row): Promise<ModuleState> {
  const dir = moduleDir(row.id, row.version);
  const assets = new Map<string, Buffer>();
  let integrity: ModuleState['integrity'] = 'ok';
  for (const [name, meta] of Object.entries(row.manifest.files)) {
    const data = await fs.readFile(path.join(dir, name)).catch(() => null);
    if (!data || sha256(data) !== meta.sha256) {
      integrity = 'tampered';
      continue;
    }
    if (PUBLIC_ASSETS.includes(name)) assets.set(name, data);
  }
  return {
    row,
    signature: signatureInfo(row.manifest, row.signature),
    licenseSignatureValid: !!row.license && verify(row.license.payload, row.license.signature, TRUSTED_KEYS),
    integrity,
    assets,
    runtime: null,
    runtimeError: null,
  };
}

/* ------------------------------------------------------------------ */
/* Exécution côté serveur                                              */
/* ------------------------------------------------------------------ */

const exposedErrors = new WeakSet<Error>();
const replies = new WeakSet<object>();
const ROUTE_PATTERN = /^\/([a-z0-9:][a-z0-9/:_-]{0,99})?$/;
const STORAGE_KEY_PATTERN = /^[A-Za-z0-9:._-]{1,100}$/;
const COOKIE_NAME_PATTERN = /^sm_[a-z0-9_]{1,40}$/;
const locks = new Map<string, Promise<unknown>>();

const splitPath = (p: string) => p.split('/').filter(Boolean);

function matchRoute(routes: RouteEntry[], method: string, routePath: string): { handler: ModuleRouteHandler; params: Record<string, string> } | null {
  const parts = splitPath(routePath);
  for (const r of routes) {
    if (r.method !== method || r.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length && ok; i++) {
      const seg = r.segments[i];
      if (seg.startsWith(':')) {
        try {
          params[seg.slice(1)] = decodeURIComponent(parts[i]).slice(0, 200);
        } catch {
          ok = false;
        }
      } else ok = seg === parts[i];
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function createContext(s: ModuleState, runtime: Runtime): ServerContext {
  const { id, version } = s.row;
  const perms = new Set<string>(s.row.manifest.permissions);
  const need = (perm: string) => {
    if (!perms.has(perm)) throw new Error(`[module ${id}] permission non déclarée : ${perm}`);
  };
  const prefix = `[module:${id}]`;
  const addRoute = (list: RouteEntry[], perm: string, method: ModuleHttpMethod) => (p: string, handler: ModuleRouteHandler) => {
    need(perm);
    if (!ROUTE_PATTERN.test(p) || typeof handler !== 'function') throw new Error(`${prefix} route invalide : ${p}`);
    list.push({ method, segments: splitPath(p), handler });
  };
  const route = (method: ModuleHttpMethod) => addRoute(runtime.routes, 'http:routes', method);
  const adminRoute = (method: ModuleHttpMethod) => addRoute(runtime.adminRoutes, 'admin:routes', method);
  const declared = new Set([...Object.keys(s.row.manifest.requires ?? {}), ...(s.row.manifest.uses ?? [])]);
  const storageKey = (key: string) => {
    need('storage');
    if (!STORAGE_KEY_PATTERN.test(key)) throw new Error(`${prefix} clé de stockage invalide`);
    return key;
  };

  return {
    module: { id, version },
    settings: () => structuredClone(states.get(id)?.row.settings ?? s.row.settings) as Record<string, unknown>,
    log: {
      info: (...a) => console.log(prefix, ...a),
      warn: (...a) => console.warn(prefix, ...a),
      error: (...a) => console.error(prefix, ...a),
    },
    http: {
      get: route('GET'),
      post: route('POST'),
      reply: (body, opts = {}) => {
        const cookies = opts.cookies ?? [];
        if (cookies.length) need('http:cookies');
        for (const c of cookies) {
          if (!COOKIE_NAME_PATTERN.test(c?.name ?? '') || typeof c.value !== 'string' || c.value.length > 2000) throw new Error(`${prefix} cookie invalide : ${c?.name}`);
        }
        const status = Number(opts.status) >= 200 && Number(opts.status) < 600 ? Number(opts.status) : 200;
        const reply: ModuleReply = { __snapifyReply: true, body, status, cookies };
        replies.add(reply);
        return reply;
      },
    },
    db: {
      collection: (name) => {
        need('database');
        return createCollection(id, name);
      },
    },
    lock: async (key, fn) => {
      const k = `${id}:${key}`;
      const prev = locks.get(k) ?? Promise.resolve();
      const run = prev.catch(() => undefined).then(fn);
      const tail = run.catch(() => undefined);
      locks.set(k, tail);
      try {
        return await run;
      } finally {
        if (locks.get(k) === tail) locks.delete(k);
      }
    },
    mail: {
      send: async (msg) => {
        need('mail:send');
        if (!msg || typeof msg.subject !== 'string' || typeof msg.html !== 'string') throw new Error(`${prefix} e-mail invalide`);
        return sendMail({ to: msg.to, subject: msg.subject.slice(0, 200), html: msg.html, text: msg.text, replyTo: msg.replyTo, kind: 'notification' });
      },
      render: (content) => renderEmail(site!, content),
    },
    provide: (services) => {
      if (!services || typeof services !== 'object') throw new Error(`${prefix} services invalides`);
      runtime.services = services;
    },
    use: <T,>(moduleId: string) => {
      if (!declared.has(moduleId)) throw new Error(`${prefix} module non déclaré dans requires/uses : ${moduleId}`);
      const dep = states.get(moduleId);
      if (!dep || gateStatus(dep).code !== 'active' || !dep.runtime?.services) return null;
      return dep.runtime.services as T;
    },
    error: (status, message) => {
      const err = Object.assign(new Error(String(message)), { status: Number(status) >= 400 && Number(status) < 600 ? Number(status) : 500 });
      exposedErrors.add(err);
      return err;
    },
    env: (name) => {
      need(`env:${name}`);
      return process.env[name];
    },
    fetch: async (url, init) => {
      if (perms.has('net:outbound')) {
        const { outboundFetch } = await import('./outbound');
        return outboundFetch(String(url), init);
      }
      const target = new URL(url);
      need(`net:${target.hostname}`);
      if (target.protocol !== 'https:') throw new Error(`${prefix} seules les requêtes HTTPS sont autorisées`);
      // 90 s : LLM / images (DALL·E, Imagen) dépassent souvent 30 s.
      const signal = init?.signal ?? AbortSignal.timeout(90_000);
      return fetch(target, { ...init, redirect: 'error', signal });
    },
    ftp: {
      list: async (opts) => {
        need('net:ftp');
        const { ftpList } = await import('./outbound');
        return ftpList(opts);
      },
      readText: async (opts) => {
        need('net:ftp');
        const { ftpReadText } = await import('./outbound');
        return ftpReadText(opts);
      },
    },
    site: () => {
      need('site:read');
      const g = site!.general;
      return {
        name: site!.branding.siteName,
        legalName: g.legalName,
        phone: g.phone,
        phoneClean: g.phoneClean,
        email: g.contactEmail,
        slaHours: g.slaHours,
        address: g.address,
        publicUrl: site!.settings.publicUrl,
        colors: { ...site!.branding.colors },
      };
    },
    files: {
      saveImage: async (image, opts = {}) => {
        need('files');
        const maxBytes = Math.min(Math.max(Number(opts.maxBytes) || FILES_MAX_BYTES, 1024), FILES_MAX_BYTES);
        let decoded: { buf: Buffer; ext: string };
        try {
          decoded = decodeImage(image ?? {}, maxBytes);
        } catch (e) {
          if (!(e instanceof ImageError)) throw e;
          const err = Object.assign(new Error(e.message), { status: e.status });
          exposedErrors.add(err);
          throw err;
        }
        return saveImage(`modules/${id}`, String(opts.prefix || 'image'), decoded.buf, decoded.ext);
      },
      delete: async (url) => {
        need('files');
        await removeImage(`modules/${id}`, url);
      },
    },
    storage: {
      get: async (key) => {
        const [row] = await db
          .select({ value: t.moduleStorage.value })
          .from(t.moduleStorage)
          .where(and(eq(t.moduleStorage.moduleId, id), eq(t.moduleStorage.key, storageKey(key))));
        return row?.value as never;
      },
      set: async (key, value) => {
        const k = storageKey(key);
        const json = JSON.stringify(value ?? null);
        if (Buffer.byteLength(json) > STORAGE_MAX_VALUE) throw new Error(`${prefix} valeur de stockage trop volumineuse (64 Ko max.)`);
        const [{ n }] = await db.select({ n: count() }).from(t.moduleStorage).where(eq(t.moduleStorage.moduleId, id));
        if (n >= STORAGE_MAX_KEYS) {
          const [exists] = await db.select({ k: t.moduleStorage.key }).from(t.moduleStorage).where(and(eq(t.moduleStorage.moduleId, id), eq(t.moduleStorage.key, k)));
          if (!exists) throw new Error(`${prefix} nombre maximal de clés atteint (${STORAGE_MAX_KEYS})`);
        }
        await db
          .insert(t.moduleStorage)
          .values({ moduleId: id, key: k, value: JSON.parse(json), updatedAt: new Date() })
          .onConflictDoUpdate({ target: [t.moduleStorage.moduleId, t.moduleStorage.key], set: { value: JSON.parse(json), updatedAt: new Date() } });
      },
      delete: async (key) => {
        await db.delete(t.moduleStorage).where(and(eq(t.moduleStorage.moduleId, id), eq(t.moduleStorage.key, storageKey(key))));
      },
    },
    admin: {
      status: (provider) => {
        runtime.status = provider;
      },
      get: adminRoute('GET'),
      post: adminRoute('POST'),
      put: adminRoute('PUT'),
      delete: adminRoute('DELETE'),
    },
  };
}

async function activateServer(s: ModuleState) {
  const meta = s.row.manifest.files['server.mjs'];
  if (!meta) return;
  const file = path.join(moduleDir(s.row.id, s.row.version), 'server.mjs');
  try {
    const data = await fs.readFile(file);
    if (sha256(data) !== meta.sha256) {
      s.integrity = 'tampered';
      return;
    }
    const mod = (await import(`${pathToFileURL(file).href}?sha=${meta.sha256}`)) as { default?: ServerModule };
    if (!mod.default || typeof mod.default.activate !== 'function') throw new Error('le bundle serveur n’exporte pas de module (defineServerModule)');
    const runtime: Runtime = { routes: [], adminRoutes: [], services: null };
    const result = await withTimeout(Promise.resolve(mod.default.activate(createContext(s, runtime))), ACTIVATE_TIMEOUT_MS, 'activation trop longue');
    if (typeof result === 'function') runtime.deactivate = result;
    s.runtime = runtime;
    s.runtimeError = null;
  } catch (e) {
    s.runtime = null;
    s.runtimeError = `Erreur au démarrage du module : ${e instanceof Error ? e.message : String(e)}`;
    console.error(`[modules] ${s.row.id}`, e);
  }
}

function deactivateServer(s: ModuleState) {
  if (!s.runtime) return;
  try {
    s.runtime.deactivate?.();
  } catch (e) {
    console.error(`[modules] ${s.row.id} : erreur à la désactivation`, e);
  }
  s.runtime = null;
}

/** Démarre ou arrête le code serveur selon le statut courant (licence expirée, désactivation…). */
async function reconcile(s: ModuleState) {
  const shouldRun = gateStatus(s).code === 'active' && !!s.row.manifest.entries.server;
  if (shouldRun && !s.runtime && !s.runtimeError) await activateServer(s);
  if (!shouldRun) deactivateServer(s);
}

/** Modules triés pour que chaque dépendance démarre avant les modules qui l'utilisent. */
function inDependencyOrder(): ModuleState[] {
  const out: ModuleState[] = [];
  const seen = new Set<string>();
  const visit = (s: ModuleState, depth: number) => {
    if (seen.has(s.row.id) || depth > 10) return;
    seen.add(s.row.id);
    const m = s.row.manifest;
    for (const dep of [...Object.keys(m.requires ?? {}), ...(m.uses ?? [])]) {
      const d = states.get(dep);
      if (d) visit(d, depth + 1);
    }
    out.push(s);
  };
  for (const s of states.values()) visit(s, 0);
  return out;
}

export async function refreshModules() {
  await refreshSite();
  const ordered = inDependencyOrder();
  // Arrêts d'abord (dépendants en premier), puis démarrages dans l'ordre des dépendances.
  for (const s of [...ordered].reverse()) if (gateStatus(s).code !== 'active') deactivateServer(s);
  for (const s of ordered) await reconcile(s);
}

/* ------------------------------------------------------------------ */
/* Installation                                                        */
/* ------------------------------------------------------------------ */

interface Staged {
  manifest: PackagedManifest;
  files: Map<string, Buffer>;
  signature?: Signature;
  license?: SignedLicense;
  source: Row['source'];
  initialSettings?: Record<string, unknown>;
  initialEnabled?: boolean;
  expires: number;
}

const staged = new Map<string, Staged>();

function inspect(entry: Staged, token: string): StagedPackageInfo {
  const m = entry.manifest;
  const sig = signatureInfo(m, entry.signature);
  const existing = states.get(m.id);
  const license = entry.license ?? (existing?.row.license || undefined);
  const licenseValid = !!license && verify(license.payload, license.signature, TRUSTED_KEYS);
  const lic = evaluateLicense(m.id, m.pricing, license, licenseValid, sig);
  const compatible = satisfies(SNAPIFY_MODULE_API_VERSION, m.engines.snapify);
  const blockers: string[] = [];
  if (!sig.valid && !sig.devUnsigned) {
    blockers.push(
      entry.signature
        ? 'Signature invalide : le paquet a été modifié ou n’a pas été émis par NOVALABS.'
        : 'Paquet non signé : seuls les modules signés par NOVALABS peuvent être installés.'
    );
  }
  if (!compatible) blockers.push(`Ce module nécessite Snapify ${m.engines.snapify} (API actuelle ${SNAPIFY_MODULE_API_VERSION}).`);
  if (entry.license && lic.state !== 'valid' && lic.state !== 'dev') blockers.push(`Licence fournie refusée : ${lic.message}.`);
  if (existing && existing.row.kind !== packageKind(m)) blockers.push(`L’identifiant ${m.id} est déjà utilisé par un ${existing.row.kind === 'theme' ? 'thème' : 'module'} installé.`);
  const shot = m.screenshot ? entry.files.get(m.screenshot) : undefined;
  const mime = m.screenshot?.endsWith('.png') ? 'image/png' : m.screenshot?.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const installedVersion = existing?.row.version ?? null;
  const cmp = installedVersion ? compareVersions(m.version, installedVersion) : 1;
  return {
    token,
    manifest: {
      id: m.id,
      kind: packageKind(m),
      name: m.name,
      version: m.version,
      description: m.description,
      author: m.author,
      pricing: m.pricing,
      category: m.category,
      icon: m.icon,
      permissions: m.permissions,
      slots: m.slots,
      engines: m.engines,
      hasServer: !!m.entries.server,
      settingsCount: m.settings.length,
      ...(shot ? { screenshot: `data:${mime};base64,${shot.toString('base64')}` } : {}),
    },
    signature: sig,
    license: lic,
    compatible,
    installedVersion,
    action: !installedVersion ? 'install' : cmp > 0 ? 'update' : cmp === 0 ? 'reinstall' : 'downgrade',
    blockers,
  };
}

/** Décode et vérifie un paquet, puis le garde en attente de confirmation. */
export function stagePackage(
  buf: Buffer,
  source: Row['source'],
  initial?: { settings?: Record<string, unknown>; enabled?: boolean }
): StagedPackageInfo {
  const { pkg, files } = decodePackage(buf);
  const now = Date.now();
  for (const [k, v] of staged) if (v.expires < now) staged.delete(k);
  while (staged.size >= 10) staged.delete(staged.keys().next().value!);
  const token = crypto.randomBytes(18).toString('base64url');
  const entry: Staged = {
    manifest: pkg.manifest,
    files,
    signature: pkg.signature,
    license: pkg.license,
    source,
    initialSettings: initial?.settings,
    initialEnabled: initial?.enabled,
    expires: now + STAGE_TTL_MS,
  };
  staged.set(token, entry);
  return inspect(entry, token);
}

export function stagedKind(token: string): 'theme' | 'module' | null {
  const entry = staged.get(token);
  return entry ? packageKind(entry.manifest) : null;
}

export function installStaged(token: string): Promise<InstalledModuleInfo> {
  return serialize(async () => {
    const entry = staged.get(token);
    if (!entry || entry.expires < Date.now()) throw new ModuleError(410, 'Ce paquet n’est plus disponible : recommencez l’opération.');
    const check = inspect(entry, token);
    if (check.blockers.length) throw new ModuleError(422, check.blockers.join(' '));
    staged.delete(token);
    await refreshSite();

    const m = entry.manifest;
    const existing = states.get(m.id);
    const finalDir = moduleDir(m.id, m.version);
    const tmp = path.join(MODULES_DIR, `.tmp-${crypto.randomBytes(6).toString('hex')}`);
    await fs.mkdir(tmp, { recursive: true });
    try {
      for (const [name, data] of entry.files) await fs.writeFile(path.join(tmp, name), data, { mode: 0o644 });
      if (existing) deactivateServer(existing);
      await fs.mkdir(path.dirname(finalDir), { recursive: true });
      await fs.rm(finalDir, { recursive: true, force: true });
      await fs.rename(tmp, finalDir);
    } catch (e) {
      await fs.rm(tmp, { recursive: true, force: true });
      throw e;
    }

    const settings = validateSettings(m.settings, existing?.row.settings ?? entry.initialSettings ?? {}).value;
    const kind = packageKind(m);
    // Un nouveau thème s'installe inactif, sauf s'il n'y a encore aucun thème actif.
    const defaultEnabled = kind === 'theme' ? !activeThemeState() : true;
    const values = {
      kind,
      version: m.version,
      enabled: existing ? existing.row.enabled : entry.initialEnabled ?? defaultEnabled,
      manifest: m,
      signature: entry.signature ?? null,
      license: entry.license ?? existing?.row.license ?? null,
      settings,
      source: entry.source,
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(t.modules)
      .values({ id: m.id, ...values, installedAt: new Date() })
      .onConflictDoUpdate({ target: t.modules.id, set: values })
      .returning();

    for (const dir of await fs.readdir(path.join(MODULES_DIR, m.id))) {
      if (dir !== m.version) await fs.rm(path.join(MODULES_DIR, m.id, dir), { recursive: true, force: true });
    }
    const state = await loadState(row);
    states.set(m.id, state);
    await refreshModules();
    console.log(`[modules] ${kind === 'theme' ? 'thème ' : ''}${m.id} ${m.version} installé (${entry.source})`);
    return info(state);
  });
}

function requireState(id: string): ModuleState {
  const s = states.get(id);
  if (!s) throw new ModuleError(404, 'Module non installé');
  return s;
}

async function saveRow(s: ModuleState, patch: Partial<Pick<Row, 'enabled' | 'settings' | 'license'>>) {
  const [row] = await db
    .update(t.modules)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(t.modules.id, s.row.id))
    .returning();
  s.row = row;
}

export function uninstallModule(id: string): Promise<void> {
  return serialize(async () => {
    const s = requireState(id);
    if (isTheme(s) && s.row.enabled) throw new ModuleError(409, 'Ce thème est actif : activez un autre thème avant de le supprimer.');
    deactivateServer(s);
    await db.delete(t.moduleStorage).where(eq(t.moduleStorage.moduleId, id));
    await deleteModuleRecords(id);
    await db.delete(t.modules).where(eq(t.modules.id, id));
    states.delete(id);
    await fs.rm(path.join(MODULES_DIR, id), { recursive: true, force: true });
    await fs.rm(path.join(getDataPaths().UPLOADS_DIR, 'modules', id), { recursive: true, force: true });
    await refreshModules();
    console.log(`[modules] ${id} désinstallé`);
  });
}

export function setModuleEnabled(id: string, enabled: boolean): Promise<InstalledModuleInfo> {
  return serialize(async () => {
    const s = requireState(id);
    if (isTheme(s)) throw new ModuleError(400, 'Un thème s’active depuis Apparence > Thèmes.');
    await saveRow(s, { enabled });
    s.runtimeError = null;
    await refreshModules();
    return info(s);
  });
}

export function updateModuleSettings(id: string, input: unknown): Promise<{ settings?: Record<string, unknown>; errors?: Record<string, string> }> {
  return serialize(async () => {
    const s = requireState(id);
    const { value, errors } = validateSettings(s.row.manifest.settings, input, s.row.settings);
    if (Object.keys(errors).length) return { errors };
    await saveRow(s, { settings: value });
    return { settings: value };
  });
}

export function setModuleLicense(id: string, key: string): Promise<InstalledModuleInfo> {
  return serialize(async () => {
    const s = requireState(id);
    const license = decodeLicenseKey(key);
    const valid = verify(license.payload, license.signature, TRUSTED_KEYS);
    await refreshSite();
    const lic = evaluateLicense(id, s.row.manifest.pricing, license, valid, s.signature);
    if (license.payload?.moduleId !== id) throw new ModuleError(400, 'Cette licence concerne un autre module');
    if (lic.state !== 'valid') throw new ModuleError(400, lic.message);
    await saveRow(s, { license });
    s.licenseSignatureValid = true;
    s.runtimeError = null;
    await refreshModules();
    return info(s);
  });
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

function info(s: ModuleState): InstalledModuleInfo {
  const m = s.row.manifest;
  return {
    id: m.id,
    kind: s.row.kind,
    name: m.name,
    version: m.version,
    description: m.description,
    author: m.author,
    pricing: m.pricing,
    category: m.category,
    icon: m.icon,
    permissions: m.permissions,
    slots: m.slots,
    enabled: s.row.enabled,
    source: s.row.source,
    installedAt: s.row.installedAt.toISOString(),
    updatedAt: s.row.updatedAt.toISOString(),
    status: statusOf(s),
    signature: s.signature,
    license: licenseOf(s),
    hasSettings: m.settings.length > 0,
    hasServer: !!m.entries.server,
    routes: m.routes ?? [],
    widgets: m.widgets ?? [],
    adminPages: m.adminPages ?? [],
    requires: m.requires ?? {},
    admin:
      s.assets.has('admin.js') && gateStatus(s).code === 'active'
        ? { script: assetUrl(s, 'admin.js'), ...(s.assets.has('admin.css') ? { style: assetUrl(s, 'admin.css') } : {}) }
        : null,
  };
}

export async function listModules(): Promise<InstalledModuleInfo[]> {
  await refreshModules();
  return [...states.values()].filter((s) => !isTheme(s)).map(info).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function installedVersions(): Map<string, string> {
  return new Map([...states.values()].map((s) => [s.row.id, s.row.version]));
}

export async function moduleDetail(id: string): Promise<InstalledModuleDetail> {
  await refreshModules();
  const s = requireState(id);
  if (isTheme(s)) throw new ModuleError(404, 'Module non installé');
  let report: ModuleStatusReport | null = null;
  if (s.runtime?.status) {
    try {
      report = await withTimeout(Promise.resolve(s.runtime.status()), 3000, 'délai dépassé');
    } catch (e) {
      report = { alerts: [{ tone: 'warning', text: `Indicateurs indisponibles : ${e instanceof Error ? e.message : 'erreur'}` }] };
    }
  }
  return { ...info(s), settingsSchema: s.row.manifest.settings, settings: s.row.settings, report };
}

const assetUrl = (s: ModuleState, file: string) => `/_modules/${s.row.id}/${s.row.version}/${file}?h=${s.row.manifest.files[file].sha256.slice(0, 12)}`;

export async function publicModules(): Promise<PublicModuleDescriptor[]> {
  await refreshSite();
  return [...states.values()]
    .filter((s) => !isTheme(s) && gateStatus(s).code === 'active' && !s.runtimeError && s.assets.has('public.js'))
    .map((s) => ({
      id: s.row.id,
      version: s.row.version,
      slots: s.row.manifest.slots,
      routes: s.row.manifest.routes ?? [],
      widgets: (s.row.manifest.widgets ?? []).map((w) => w.id),
      script: assetUrl(s, 'public.js'),
      ...(s.assets.has('public.css') ? { style: assetUrl(s, 'public.css') } : {}),
      settings: publicSettings(s.row.manifest.settings, s.row.settings),
    }));
}

/** Config publique reCAPTCHA (module hamdiayari.recaptcha) si actif et configuré. */
export function publicRecaptchaConfig(): { siteKey: string; version: 'v2' | 'v3'; action: string } | null {
  const s = states.get('hamdiayari.recaptcha');
  if (!s || isTheme(s) || gateStatus(s).code !== 'active') return null;
  const st = s.row.settings as Record<string, unknown>;
  if (st.enabled === false) return null;
  const siteKey = typeof st.siteKey === 'string' ? st.siteKey.trim() : '';
  const secretKey = typeof st.secretKey === 'string' ? st.secretKey.trim() : '';
  if (!siteKey || !secretKey) return null;
  return {
    siteKey,
    version: st.version === 'v3' ? 'v3' : 'v2',
    action: typeof st.v3Action === 'string' && st.v3Action.trim() ? st.v3Action.trim().slice(0, 40) : 'contact',
  };
}

/** Vérifie un jeton reCAPTCHA auprès de Google (module actif requis). */
export async function verifyRecaptchaToken(token: string, remoteip?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = states.get('hamdiayari.recaptcha');
  if (!s || isTheme(s) || gateStatus(s).code !== 'active') return { ok: true };
  const st = s.row.settings as Record<string, unknown>;
  if (st.enabled === false) return { ok: true };
  const secret = typeof st.secretKey === 'string' ? st.secretKey.trim() : '';
  if (!secret) return { ok: false, error: 'reCAPTCHA non configuré (clé secrète manquante).' };
  if (!token?.trim()) return { ok: false, error: 'Cochez la case « Je ne suis pas un robot ».' };

  const body = new URLSearchParams({ secret, response: token.trim() });
  if (remoteip) body.set('remoteip', remoteip.slice(0, 64));
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { success?: boolean; score?: number };
    if (!data.success) return { ok: false, error: 'Vérification anti-robot échouée. Réessayez.' };
    if (st.version === 'v3') {
      const min = Number(st.v3MinScore);
      const threshold = Number.isFinite(min) ? Math.min(1, Math.max(0, min)) : 0.5;
      if (Number(data.score ?? 0) < threshold) {
        return { ok: false, error: 'Score anti-robot insuffisant. Réessayez ou contactez-nous par téléphone.' };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Impossible de joindre Google reCAPTCHA. Réessayez plus tard.' };
  }
}

/**
 * Fichier public servi depuis la copie vérifiée en mémoire : modules actifs, thèmes vérifiés
 * (même inactifs, pour l'aperçu) et captures d'écran des thèmes intacts.
 */
export function moduleAsset(id: string, version: string, file: string): Buffer | null {
  const s = states.get(id);
  if (!s || s.row.version !== version || !PUBLIC_ASSETS.includes(file)) return null;
  const code = gateStatus(s).code;
  const shot = (SCREENSHOT_FILES as readonly string[]).includes(file);
  const allowed = shot ? isTheme(s) && code !== 'unsigned' && code !== 'tampered' : isTheme(s) ? usable(s) && !ADMIN_ASSETS.includes(file) : code === 'active';
  return allowed ? s.assets.get(file) ?? null : null;
}

/* ------------------------------------------------------------------ */
/* Thèmes                                                              */
/* ------------------------------------------------------------------ */

function activeThemeState(): ModuleState | undefined {
  return [...states.values()].find((s) => isTheme(s) && s.row.enabled);
}

function themeDescriptor(s: ModuleState): PublicThemeDescriptor | null {
  if (!usable(s) || !s.assets.has('public.js')) return null;
  return {
    id: s.row.id,
    version: s.row.version,
    script: assetUrl(s, 'public.js'),
    ...(s.assets.has('public.css') ? { style: assetUrl(s, 'public.css') } : {}),
    // Les options d'un thème sont toutes des choix de présentation : elles sont publiques.
    settings: structuredClone(s.row.settings),
  };
}

function themeInfo(s: ModuleState): InstalledThemeInfo {
  const shot = SCREENSHOT_FILES.find((f) => s.assets.has(f));
  return { ...info(s), active: s.row.enabled, ...(shot ? { screenshot: assetUrl(s, shot) } : {}) };
}

/** Thème appliqué au site : le thème actif, ou le thème par défaut s'il est bloqué. */
export async function publicTheme(): Promise<PublicThemeDescriptor | null> {
  await refreshSite();
  const active = activeThemeState();
  const current = active && gateStatus(active).code === 'active' ? themeDescriptor(active) : null;
  if (current) return current;
  const fallback = states.get(DEFAULT_THEME_ID);
  return fallback && isTheme(fallback) ? themeDescriptor(fallback) : null;
}

export async function listThemes(): Promise<InstalledThemeInfo[]> {
  await refreshModules();
  return [...states.values()]
    .filter(isTheme)
    .map(themeInfo)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'fr'));
}

function requireTheme(id: string): ModuleState {
  const s = states.get(id);
  if (!s || !isTheme(s)) throw new ModuleError(404, 'Thème non installé');
  return s;
}

export async function themeDetail(id: string): Promise<InstalledThemeDetail> {
  await refreshModules();
  const s = requireTheme(id);
  return { ...themeInfo(s), settingsSchema: s.row.manifest.settings, settings: s.row.settings, descriptor: themeDescriptor(s) };
}

export function activateTheme(id: string): Promise<InstalledThemeInfo> {
  return serialize(async () => {
    await refreshSite();
    const s = requireTheme(id);
    if (!usable(s)) throw new ModuleError(422, `Ce thème ne peut pas être activé : ${gateStatus(s).message}`);
    const previous = activeThemeState();
    const previousId = previous && previous !== s ? previous.row.id : null;
    for (const other of states.values()) {
      if (isTheme(other) && other !== s && other.row.enabled) await saveRow(other, { enabled: false });
    }
    if (!s.row.enabled) await saveRow(s, { enabled: true });
    // Contenu CMS (accueil + menus) isolé par thème : sauvegarde l’ancien, restaure le nouveau
    try {
      const { switchThemeContent } = await import('../cms/themeContent');
      await switchThemeContent(previousId, id);
    } catch (e) {
      console.error(`[themes] bascule contenu impossible pour ${id}`, e);
    }
    console.log(`[themes] thème actif : ${id}`);
    return themeInfo(s);
  });
}

/* ------------------------------------------------------------------ */
/* API publique des modules : /api/modules/<id>/<route>                */
/* ------------------------------------------------------------------ */

const hits = new Map<string, { n: number; reset: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    return false;
  }
  return ++entry.n > RATE_LIMIT_PER_MIN;
}

export interface ModuleResponse {
  status: number;
  body: unknown;
  cookies?: ModuleCookie[];
}

async function runHandler(id: string, handler: ModuleRouteHandler, req: ModuleRequest): Promise<ModuleResponse> {
  await refreshSite();
  try {
    const result = await withTimeout(Promise.resolve(handler(req)), HANDLER_TIMEOUT_MS, 'délai dépassé');
    if (result && typeof result === 'object' && replies.has(result)) {
      const r = result as ModuleReply;
      return { status: r.status, body: r.body ?? null, cookies: r.cookies };
    }
    return { status: 200, body: result ?? null };
  } catch (e) {
    if (e instanceof Error && exposedErrors.has(e)) return { status: (e as Error & { status: number }).status, body: { error: e.message } };
    console.error(`[module:${id}] erreur non gérée`, e);
    return { status: 500, body: { error: 'Erreur du module' } };
  }
}

const filterCookies = (s: ModuleState, cookies: Record<string, string>) =>
  s.row.manifest.permissions.includes('http:cookies') ? Object.fromEntries(Object.entries(cookies).filter(([k]) => COOKIE_NAME_PATTERN.test(k))) : {};

export async function dispatchModuleRequest(
  id: string,
  method: string,
  routePath: string,
  req: Omit<ModuleRequest, 'method' | 'path' | 'params' | 'admin'>
): Promise<ModuleResponse> {
  const s = states.get(id);
  if (!s || gateStatus(s).code !== 'active' || !s.runtime) return { status: 404, body: { error: 'Module indisponible' } };
  if (method !== 'GET' && method !== 'POST') return { status: 405, body: { error: 'Méthode non autorisée' } };
  const match = matchRoute(s.runtime.routes, method, routePath);
  if (!match) return { status: 404, body: { error: 'Route inconnue' } };
  if (rateLimited(`${id}|${req.ip}`)) return { status: 429, body: { error: 'Trop de requêtes, réessayez dans une minute.' } };
  return runHandler(id, match.handler, { ...req, cookies: filterCookies(s, req.cookies), method, path: routePath, params: match.params });
}

/** Routes d'administration d'un module (/api/admin/modules/<id>/api/…), après authentification. */
export async function dispatchModuleAdminRequest(
  id: string,
  method: string,
  routePath: string,
  req: Omit<ModuleRequest, 'method' | 'path' | 'params' | 'cookies'> & { admin: NonNullable<ModuleRequest['admin']> }
): Promise<ModuleResponse> {
  const s = states.get(id);
  if (!s || isTheme(s) || gateStatus(s).code !== 'active' || !s.runtime) return { status: 404, body: { error: 'Module indisponible' } };
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) return { status: 405, body: { error: 'Méthode non autorisée' } };
  const match = matchRoute(s.runtime.adminRoutes, method, routePath);
  if (!match) return { status: 404, body: { error: 'Route inconnue' } };
  const res = await runHandler(id, match.handler, { ...req, cookies: {}, method: method as ModuleHttpMethod, path: routePath, params: match.params });
  return { status: res.status, body: res.body };
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

/** Premier démarrage : installe les modules officiels et reprend les anciens réglages du cœur. */
async function bootstrapOfficialModules() {
  const [done] = await db.select().from(t.siteSettings).where(eq(t.siteSettings.key, BOOTSTRAP_KEY));
  if (done) return;
  const legacyRows = await db.select().from(t.siteSettings).where(inArray(t.siteSettings.key, LEGACY_KEYS));
  const legacy = new Map(legacyRows.map((r) => [r.key, r.value as Record<string, unknown>]));
  const installed: string[] = [];
  for (const official of OFFICIAL_MODULES) {
    if (states.has(official.id)) continue;
    const buf = await localPackage(official.id);
    if (!buf) {
      console.error(`[modules] paquet officiel introuvable : ${official.id}`);
      return;
    }
    const old = legacy.get(official.legacyKey);
    const check = stagePackage(buf, 'marketplace', { settings: official.settings(old), enabled: official.enabled(old) });
    await installStaged(check.token);
    installed.push(official.id);
  }
  await db.insert(t.siteSettings).values({ key: BOOTSTRAP_KEY, value: { at: new Date().toISOString(), installed } }).onConflictDoNothing();
  if (legacyRows.length) await db.delete(t.siteSettings).where(inArray(t.siteSettings.key, LEGACY_KEYS));
}

/** Premier démarrage : installe et active le thème par défaut. */
async function bootstrapDefaultTheme() {
  const [done] = await db.select().from(t.siteSettings).where(eq(t.siteSettings.key, THEMES_BOOTSTRAP_KEY));
  if (done) return;
  if (!states.has(DEFAULT_THEME_ID)) {
    const buf = await localPackage(DEFAULT_THEME_ID);
    if (!buf) {
      console.error(`[themes] paquet du thème par défaut introuvable : ${DEFAULT_THEME_ID}`);
      return;
    }
    const check = stagePackage(buf, 'marketplace', { enabled: !activeThemeState() });
    await installStaged(check.token);
  }
  await db.insert(t.siteSettings).values({ key: THEMES_BOOTSTRAP_KEY, value: { at: new Date().toISOString(), installed: [DEFAULT_THEME_ID] } }).onConflictDoNothing();
}

export async function initModules() {
  await fs.mkdir(MODULES_DIR, { recursive: true });
  await refreshSite();
  for (const row of await db.select().from(t.modules)) states.set(row.id, await loadState(row));
  try {
    await bootstrapOfficialModules();
  } catch (e) {
    console.error('[modules] installation initiale impossible', e);
  }
  try {
    await bootstrapDefaultTheme();
  } catch (e) {
    console.error('[themes] installation du thème par défaut impossible', e);
  }
  await refreshModules();
  try {
    const { ensureDefaultThemePacks } = await import('../cms/themeContent');
    await ensureDefaultThemePacks();
  } catch (e) {
    console.error('[themes] packs contenu par défaut impossibles', e);
  }
  for (const s of states.values()) {
    const st = statusOf(s);
    console.log(`[${isTheme(s) ? 'themes' : 'modules'}] ${s.row.id} ${s.row.version} : ${st.message}`);
  }
  if (isDevMode()) console.warn('[modules] MODE DÉVELOPPEUR : les modules non signés sont acceptés');
  setInterval(() => void refreshModules().catch((e) => console.error('[modules] vérification périodique', e)), 10 * 60 * 1000).unref();
}
