/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Format de paquet `.snapmod` (Node uniquement) : JSON compressé gzip contenant le manifeste
 * empaqueté, les fichiers en base64, la signature Ed25519 du manifeste et, pour un module
 * gratuit, sa licence signée. Le manifeste liste l'empreinte SHA-256 de chaque fichier :
 * signer le manifeste revient donc à signer tout le contenu.
 */
import crypto from 'crypto';
import zlib from 'zlib';
import {
  LICENSE_KEY_PREFIX,
  MODULE_ID_PATTERN,
  MODULE_SLOTS,
  PERMISSION_PATTERN,
  ROUTE_PATTERN_PUBLIC,
  SCREENSHOT_FILES,
  SEMVER_PATTERN,
  type LicensePayload,
  type PackageKind,
  type PackagedManifest,
  type Signature,
  type SignedLicense,
} from './index';
import { checkFieldDefinition } from './settings';

export const PACKAGE_FORMAT = 'snapmod/1';
export const PACKAGE_EXTENSION = '.snapmod';
export const THEME_PACKAGE_EXTENSION = '.snaptheme';
export const PACKAGE_EXTENSIONS = [PACKAGE_EXTENSION, THEME_PACKAGE_EXTENSION];
export const packageExtension = (kind: PackageKind) => (kind === 'theme' ? THEME_PACKAGE_EXTENSION : PACKAGE_EXTENSION);
export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 40 * 1024 * 1024;

/** Seuls ces fichiers peuvent figurer dans un paquet. */
export const PACKAGE_FILES = ['public.js', 'public.css', 'server.mjs', 'admin.js', 'admin.css', 'README.md', ...SCREENSHOT_FILES] as const;

export interface ModulePackage {
  format: typeof PACKAGE_FORMAT;
  manifest: PackagedManifest;
  files: Record<string, string>;
  signature?: Signature;
  license?: SignedLicense;
}

export class PackageError extends Error {}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** JSON à clés triées : représentation stable et donc signable. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export const sha256 = (data: Buffer | string) => crypto.createHash('sha256').update(data).digest('hex');

export function publicKeyFromBase64(b64: string): crypto.KeyObject {
  return crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });
}

export function sign(data: unknown, privateKeyPem: string, kid: string): Signature {
  const value = crypto.sign(null, Buffer.from(canonicalJson(data)), crypto.createPrivateKey(privateKeyPem)).toString('base64');
  return { alg: 'ed25519', kid, value };
}

/** `trusted` : identifiant de clé → clé publique SPKI encodée en base64. */
export function verify(data: unknown, signature: Signature | undefined, trusted: Record<string, string>): boolean {
  if (!signature || signature.alg !== 'ed25519' || typeof signature.value !== 'string') return false;
  const key = trusted[signature.kid];
  if (!key) return false;
  try {
    return crypto.verify(null, Buffer.from(canonicalJson(data)), publicKeyFromBase64(key), Buffer.from(signature.value, 'base64'));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

function parseVersion(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a) ?? [0, 0, 0];
  const pb = parseVersion(b) ?? [0, 0, 0];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Plages acceptées : `*`, `1.2.3`, `>=1.2.3`, `^1.2.3`. */
export function satisfies(version: string, range: string): boolean {
  const r = range.trim();
  if (r === '*') return true;
  if (r.startsWith('>=')) return compareVersions(version, r.slice(2)) >= 0;
  if (r.startsWith('^')) {
    const base = parseVersion(r.slice(1));
    const v = parseVersion(version);
    if (!base || !v) return false;
    return v[0] === base[0] && compareVersions(version, r.slice(1)) >= 0;
  }
  return compareVersions(version, r) === 0;
}

/* ------------------------------------------------------------------ */
/* Manifeste                                                           */
/* ------------------------------------------------------------------ */

const isStr = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Contrôle structurel d'un manifeste ; `packaged` exige les champs ajoutés à l'empaquetage. */
export function checkManifest(m: PackagedManifest, packaged: boolean): string[] {
  const issues: string[] = [];
  if (!m || typeof m !== 'object') return ['manifeste absent'];
  if (typeof m.id !== 'string' || m.id.length > 64 || !MODULE_ID_PATTERN.test(m.id)) issues.push('identifiant invalide (format éditeur.module)');
  if (typeof m.version !== 'string' || !SEMVER_PATTERN.test(m.version)) issues.push('version invalide (semver attendu)');
  if (!isStr(m.name, 60)) issues.push('nom invalide');
  if (!isStr(m.description, 500)) issues.push('description invalide');
  if (!m.author || !isStr(m.author.name, 120)) issues.push('auteur invalide');
  if (m.pricing !== 'free' && m.pricing !== 'paid') issues.push('tarification invalide (free ou paid)');
  if (!m.engines || !isStr(m.engines.snapify, 40)) issues.push('engines.snapify manquant');
  if (m.icon !== undefined && !/^[a-z0-9-]{1,40}$/.test(m.icon)) issues.push('icône invalide');
  if (!Array.isArray(m.permissions) || m.permissions.some((p) => typeof p !== 'string' || !PERMISSION_PATTERN.test(p))) issues.push('permissions invalides');
  else if (new Set(m.permissions).size !== m.permissions.length) issues.push('permissions en double');
  if (!Array.isArray(m.slots) || m.slots.some((s) => !MODULE_SLOTS.includes(s))) issues.push('emplacements invalides');
  if (!Array.isArray(m.settings)) issues.push('réglages invalides');
  else {
    m.settings.forEach((f) => issues.push(...checkFieldDefinition(f)));
    if (new Set(m.settings.map((f) => f.key)).size !== m.settings.length) issues.push('clés de réglage en double');
  }
  if (m.kind !== undefined && m.kind !== 'module' && m.kind !== 'theme') issues.push('type de paquet invalide (module ou theme)');
  if (m.kind === 'theme') {
    if (m.permissions?.length) issues.push('un thème ne peut pas demander de permissions');
    if (m.slots?.length) issues.push('un thème ne déclare pas d’emplacements');
    if (m.entries?.server) issues.push('un thème ne peut pas contenir de code serveur');
    if (m.entries?.admin) issues.push('un thème ne peut pas contenir de pages d’administration');
    if (!m.entries?.public) issues.push('entrée public obligatoire pour un thème');
    if (m.routes?.length || m.widgets?.length || m.adminPages?.length || m.requires || m.uses?.length) issues.push('routes, widgets, pages d’administration et dépendances sont réservés aux modules');
  }
  issues.push(...checkExtensions(m));
  if (m.screenshot !== undefined && (typeof m.screenshot !== 'string' || (packaged && !(SCREENSHOT_FILES as readonly string[]).includes(m.screenshot)))) {
    issues.push('capture d’écran invalide');
  }
  if (!m.entries || typeof m.entries !== 'object' || (!m.entries.public && !m.entries.server && !m.entries.admin)) issues.push('aucune entrée public/server/admin');
  if (m.slots?.length && !m.entries?.public) issues.push('emplacements déclarés sans entrée public');
  if ((m.routes?.length || m.widgets?.length) && !m.entries?.public) issues.push('routes ou widgets déclarés sans entrée public');
  if (m.adminPages?.length && !m.entries?.admin) issues.push('pages d’administration déclarées sans entrée admin');
  if (packaged) {
    if (m.entries?.public && m.entries.public !== 'public.js') issues.push('entrée public empaquetée invalide');
    if (m.entries?.server && m.entries.server !== 'server.mjs') issues.push('entrée server empaquetée invalide');
    if (m.entries?.admin && m.entries.admin !== 'admin.js') issues.push('entrée admin empaquetée invalide');
    if (!m.files || typeof m.files !== 'object') issues.push('liste des fichiers manquante');
    else {
      for (const [name, meta] of Object.entries(m.files)) {
        if (!(PACKAGE_FILES as readonly string[]).includes(name)) issues.push(`fichier non autorisé : ${name}`);
        if (!meta || !/^[a-f0-9]{64}$/.test(meta.sha256) || !Number.isInteger(meta.size) || meta.size < 0) issues.push(`empreinte invalide : ${name}`);
      }
      for (const entry of [m.entries?.public, m.entries?.server, m.entries?.admin, m.styles, m.adminStyles, m.screenshot]) if (entry && !m.files[entry]) issues.push(`fichier manquant : ${entry}`);
    }
  }
  return issues;
}

const LOCAL_ID = /^[a-z][a-z0-9-]{0,39}$/;

/** Routes publiques, widgets, pages d'administration et dépendances (API 1.2). */
function checkExtensions(m: PackagedManifest): string[] {
  const issues: string[] = [];
  if (m.routes !== undefined) {
    if (!Array.isArray(m.routes) || m.routes.length > 20 || m.routes.some((r) => typeof r !== 'string' || r === '/' || r === '/*' || !ROUTE_PATTERN_PUBLIC.test(r))) {
      issues.push('routes invalides (ex. /boutique/* ou /panier/)');
    } else if (m.routes.some((r) => /^\/(administrator|api|_modules|uploads|blog)\//.test(r))) issues.push('route réservée par Snapify');
  }
  if (m.widgets !== undefined) {
    if (!Array.isArray(m.widgets) || m.widgets.length > 20) issues.push('widgets invalides');
    else {
      for (const w of m.widgets) {
        if (!w || !LOCAL_ID.test(w.id ?? '')) issues.push('identifiant de widget invalide');
        if (!isStr(w?.label, 60)) issues.push(`widget « ${w?.id} » : libellé invalide`);
        if (!Array.isArray(w?.fields)) issues.push(`widget « ${w?.id} » : champs invalides`);
        else w.fields.forEach((f) => issues.push(...checkFieldDefinition(f).map((i) => `widget « ${w.id} » : ${i}`)));
      }
      if (new Set(m.widgets.map((w) => w?.id)).size !== m.widgets.length) issues.push('widgets en double');
    }
  }
  if (m.adminPages !== undefined) {
    if (!Array.isArray(m.adminPages) || m.adminPages.length > 10) issues.push('pages d’administration invalides');
    else {
      for (const p of m.adminPages) {
        if (!p || !LOCAL_ID.test(p.id ?? '')) issues.push('identifiant de page d’administration invalide');
        if (!isStr(p?.label, 40)) issues.push(`page d’administration « ${p?.id} » : libellé invalide`);
        if (p?.icon !== undefined && !/^[a-z0-9-]{1,40}$/.test(p.icon)) issues.push(`page d’administration « ${p.id} » : icône invalide`);
      }
      if (new Set(m.adminPages.map((p) => p?.id)).size !== m.adminPages.length) issues.push('pages d’administration en double');
    }
  }
  if (m.requires !== undefined) {
    if (!m.requires || typeof m.requires !== 'object' || Array.isArray(m.requires)) issues.push('dépendances invalides');
    else {
      for (const [id, range] of Object.entries(m.requires)) {
        if (!MODULE_ID_PATTERN.test(id) || id === m.id || !isStr(range, 40)) issues.push(`dépendance invalide : ${id}`);
      }
    }
  }
  if (m.uses !== undefined && (!Array.isArray(m.uses) || m.uses.some((id) => typeof id !== 'string' || !MODULE_ID_PATTERN.test(id) || id === m.id))) {
    issues.push('modules facultatifs invalides');
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Paquet                                                              */
/* ------------------------------------------------------------------ */

export function encodePackage(pkg: ModulePackage): Buffer {
  return zlib.gzipSync(Buffer.from(JSON.stringify(pkg)), { level: 9 });
}

/** Décompresse et contrôle un paquet : structure, manifeste et empreintes des fichiers. */
export function decodePackage(buf: Buffer): { pkg: ModulePackage; files: Map<string, Buffer> } {
  if (buf.length > MAX_PACKAGE_BYTES) throw new PackageError('Paquet trop volumineux (20 Mo maximum)');
  let pkg: ModulePackage;
  try {
    pkg = JSON.parse(zlib.gunzipSync(buf, { maxOutputLength: MAX_UNPACKED_BYTES }).toString('utf8'));
  } catch {
    throw new PackageError('Fichier illisible : ce n’est pas un paquet .snapmod valide');
  }
  if (!pkg || pkg.format !== PACKAGE_FORMAT) throw new PackageError('Format de paquet non pris en charge');
  const issues = checkManifest(pkg.manifest, true);
  if (issues.length) throw new PackageError(`Manifeste invalide : ${issues.join(', ')}`);
  if (!pkg.files || typeof pkg.files !== 'object') throw new PackageError('Paquet sans fichiers');

  const files = new Map<string, Buffer>();
  const declared = Object.keys(pkg.manifest.files).sort();
  const shipped = Object.keys(pkg.files).sort();
  if (canonicalJson(declared) !== canonicalJson(shipped)) throw new PackageError('Les fichiers du paquet ne correspondent pas au manifeste');
  for (const name of declared) {
    const data = Buffer.from(String(pkg.files[name]), 'base64');
    const meta = pkg.manifest.files[name];
    if (data.length !== meta.size || sha256(data) !== meta.sha256) throw new PackageError(`Fichier altéré : ${name}`);
    files.set(name, data);
  }
  return { pkg, files };
}

/* ------------------------------------------------------------------ */
/* Licences                                                            */
/* ------------------------------------------------------------------ */

export function encodeLicenseKey(license: SignedLicense): string {
  return LICENSE_KEY_PREFIX + Buffer.from(JSON.stringify(license)).toString('base64url');
}

export function decodeLicenseKey(key: string): SignedLicense {
  const trimmed = key.replace(/\s+/g, '');
  if (!trimmed.startsWith(LICENSE_KEY_PREFIX)) throw new PackageError('Clé de licence invalide');
  try {
    const parsed = JSON.parse(Buffer.from(trimmed.slice(LICENSE_KEY_PREFIX.length), 'base64url').toString('utf8')) as SignedLicense;
    if (!parsed?.payload || !parsed.signature) throw new Error();
    return parsed;
  } catch {
    throw new PackageError('Clé de licence illisible');
  }
}

export function checkLicensePayload(p: LicensePayload): string[] {
  const issues: string[] = [];
  if (!p || p.v !== 1) return ['version de licence inconnue'];
  if (!isStr(p.licenseId, 80)) issues.push('identifiant de licence invalide');
  if (typeof p.moduleId !== 'string' || !MODULE_ID_PATTERN.test(p.moduleId)) issues.push('module invalide');
  if (!isStr(p.licensee, 160)) issues.push('titulaire invalide');
  if (!['free', 'standard', 'pro', 'enterprise'].includes(p.plan)) issues.push('formule invalide');
  if (!Array.isArray(p.domains) || !p.domains.length || p.domains.some((d) => typeof d !== 'string' || !/^(\*|(\*\.)?[a-z0-9.-]+)$/.test(d))) issues.push('domaines invalides');
  if (Number.isNaN(Date.parse(p.issuedAt))) issues.push('date d’émission invalide');
  if (p.expiresAt !== null && Number.isNaN(Date.parse(p.expiresAt))) issues.push('date d’expiration invalide');
  return issues;
}

/** Le domaine du site est-il couvert par la licence ? `localhost` est toujours accepté pour le développement. */
export function domainAllowed(domains: string[], host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');
  if (h === 'localhost' || h === '127.0.0.1') return true;
  return domains.some((d) => d === '*' || d === h || (d.startsWith('*.') && (h === d.slice(2) || h.endsWith(d.slice(1)))));
}
