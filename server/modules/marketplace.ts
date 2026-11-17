/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Catalogue de la marketplace : distant si MARKETPLACE_URL est défini (HTTPS uniquement),
 * sinon le catalogue local du dossier marketplace/. L'empreinte SHA-256 annoncée par le
 * catalogue est contrôlée au téléchargement ; l'authenticité repose sur la signature du paquet.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODULE_ID_PATTERN, SEMVER_PATTERN } from '../../sdk/index';
import { MAX_PACKAGE_BYTES, PackageError, sha256 } from '../../sdk/package';
import type { CatalogEntry } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = path.resolve(__dirname, '../../marketplace');
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const CACHE_MS = 5 * 60 * 1000;

export interface Catalog {
  source: 'local' | 'remote';
  url?: string;
  error?: string;
  modules: CatalogEntry[];
}

let cached: { at: number; catalog: Catalog } | null = null;

async function fetchLimited(url: URL, maxBytes: number, timeoutMs: number): Promise<Buffer> {
  if (url.protocol !== 'https:') throw new PackageError('Seules les adresses HTTPS sont acceptées');
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new PackageError(`Marketplace indisponible (HTTP ${res.status})`);
  if (Number(res.headers.get('content-length') || 0) > maxBytes) throw new PackageError('Réponse trop volumineuse');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new PackageError('Réponse trop volumineuse');
  return buf;
}

function sanitize(raw: unknown): CatalogEntry[] {
  const list = (raw as { modules?: unknown })?.modules;
  if (!Array.isArray(list)) throw new PackageError('Catalogue invalide');
  return list.filter((e): e is CatalogEntry => {
    const m = e as CatalogEntry;
    return (
      !!m &&
      typeof m.id === 'string' &&
      MODULE_ID_PATTERN.test(m.id) &&
      typeof m.version === 'string' &&
      SEMVER_PATTERN.test(m.version) &&
      typeof m.name === 'string' &&
      typeof m.package === 'string' &&
      /^[a-f0-9]{64}$/.test(m.sha256) &&
      Array.isArray(m.permissions) &&
      typeof m.engines?.snapify === 'string' &&
      (m.kind === undefined || m.kind === 'module' || m.kind === 'theme') &&
      (m.screenshot === undefined || (typeof m.screenshot === 'string' && m.screenshot.length < 300)) &&
      (m.gallery === undefined || (Array.isArray(m.gallery) && m.gallery.every((g) => typeof g === 'string' && g.length < 300))) &&
      (m.priceMillimes === undefined || (typeof m.priceMillimes === 'number' && m.priceMillimes >= 0))
    );
  });
}

const SCREENSHOT_NAME = /^[a-z0-9.-]+\.(jpg|png|webp)$/;
const GALLERY_FILE = /^[a-z0-9.-]+\.(jpg|png|webp)$/;
const MODULE_DIR = /^[a-z0-9.-]+$/;

/** URL affichable d'une capture du catalogue : servie localement, ou HTTPS du catalogue distant. */
export function screenshotUrl(catalog: Catalog, entry: CatalogEntry): string | undefined {
  if (!entry.screenshot) return undefined;
  if (catalog.source === 'remote' && catalog.url && !catalog.error) {
    try {
      const url = new URL(entry.screenshot, catalog.url);
      return url.protocol === 'https:' ? url.href : undefined;
    } catch {
      return undefined;
    }
  }
  const name = path.basename(entry.screenshot);
  return SCREENSHOT_NAME.test(name) ? `/_marketplace/screenshots/${name}` : undefined;
}

/** URLs des captures galerie (catalogue local ou distant). */
export function galleryUrls(catalog: Catalog, entry: CatalogEntry): string[] {
  if (!entry.gallery?.length) return [];
  return entry.gallery
    .map((g) => {
      if (catalog.source === 'remote' && catalog.url && !catalog.error) {
        try {
          const url = new URL(g, catalog.url);
          return url.protocol === 'https:' ? url.href : '';
        } catch {
          return '';
        }
      }
      // gallery/<moduleId>/<file>
      const parts = g.replace(/^\/+/, '').split('/');
      if (parts[0] !== 'gallery' || parts.length !== 3) return '';
      const [, moduleId, file] = parts;
      if (!MODULE_DIR.test(moduleId) || !GALLERY_FILE.test(file)) return '';
      return `/_marketplace/gallery/${moduleId}/${file}`;
    })
    .filter(Boolean);
}

/** Capture d'écran du catalogue local (`marketplace/screenshots/`). */
export async function localScreenshot(name: string): Promise<Buffer | null> {
  if (!SCREENSHOT_NAME.test(name)) return null;
  return fs.readFile(path.join(LOCAL_DIR, 'screenshots', name)).catch(() => null);
}

/** Image de galerie locale (`marketplace/gallery/<moduleId>/<file>`). */
export async function localGalleryImage(moduleId: string, file: string): Promise<Buffer | null> {
  if (!MODULE_DIR.test(moduleId) || !GALLERY_FILE.test(file)) return null;
  const abs = path.resolve(LOCAL_DIR, 'gallery', moduleId, file);
  if (!abs.startsWith(path.join(LOCAL_DIR, 'gallery') + path.sep)) return null;
  return fs.readFile(abs).catch(() => null);
}

async function localCatalog(): Promise<CatalogEntry[]> {
  try {
    return sanitize(JSON.parse(await fs.readFile(path.join(LOCAL_DIR, 'catalog.json'), 'utf8')));
  } catch {
    return [];
  }
}

export async function getCatalog(force = false): Promise<Catalog> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.catalog;
  const remote = process.env.MARKETPLACE_URL?.trim();
  let catalog: Catalog;
  if (remote) {
    try {
      const buf = await fetchLimited(new URL(remote), MAX_CATALOG_BYTES, 15_000);
      catalog = { source: 'remote', url: remote, modules: sanitize(JSON.parse(buf.toString('utf8'))) };
    } catch (e) {
      catalog = {
        source: 'local',
        url: remote,
        error: `Catalogue distant inaccessible (${e instanceof Error ? e.message : 'erreur'}) : affichage du catalogue local.`,
        modules: await localCatalog(),
      };
    }
  } else {
    catalog = { source: 'local', modules: await localCatalog() };
  }
  cached = { at: Date.now(), catalog };
  return catalog;
}

export async function downloadPackage(id: string): Promise<Buffer> {
  const catalog = await getCatalog();
  const entry = catalog.modules.find((m) => m.id === id);
  if (!entry) throw new PackageError('Élément absent du catalogue');
  let buf: Buffer;
  if (catalog.source === 'remote') {
    buf = await fetchLimited(new URL(entry.package, catalog.url), MAX_PACKAGE_BYTES, 60_000);
  } else {
    const file = path.resolve(LOCAL_DIR, entry.package);
    if (!file.startsWith(LOCAL_DIR + path.sep)) throw new PackageError('Chemin de paquet invalide');
    buf = await fs.readFile(file);
  }
  if (sha256(buf) !== entry.sha256) throw new PackageError('Le paquet téléchargé ne correspond pas à l’empreinte du catalogue');
  return buf;
}

/** Paquet du catalogue local (installation initiale des modules officiels, sans réseau). */
export async function localPackage(id: string): Promise<Buffer | null> {
  const entry = (await localCatalog()).find((m) => m.id === id);
  if (!entry) return null;
  const file = path.resolve(LOCAL_DIR, entry.package);
  if (!file.startsWith(LOCAL_DIR + path.sep)) return null;
  const buf = await fs.readFile(file).catch(() => null);
  return buf && sha256(buf) === entry.sha256 ? buf : null;
}
