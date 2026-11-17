/**
 * Connecteur automatique URL → SEO (rapide, parallèle, < 45 s typique).
 */
import type { ConnectorDetect, RedirectRecord, SeoRecord, UploadedFile } from '../types';
import { mergeRecords } from '../connectors';
import { pathFromUrl, slugFromPath } from '../connectors/utils';
import { recordFromHtml } from './htmlParse';

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export type FtpFn = {
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

export type RemoteCreds = {
  wpUser?: string;
  wpAppPassword?: string;
  ftp?: {
    host: string;
    port?: number;
    user: string;
    password: string;
    secure?: boolean;
    root?: string;
  };
};

export type ProgressFn = (message: string, pct?: number) => void | Promise<void>;

function originOf(siteUrl: string): string {
  const u = new URL(siteUrl.includes('://') ? siteUrl : `https://${siteUrl}`);
  return `${u.protocol}//${u.host}`;
}

async function getText(
  fetchFn: FetchFn,
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; text: string; url: string }> {
  try {
    const res = await fetchFn(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(12_000) });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : 'erreur', url };
  }
}

function authHeader(creds?: RemoteCreds): HeadersInit | undefined {
  if (!creds?.wpUser || !creds?.wpAppPassword) return undefined;
  const token = Buffer.from(`${creds.wpUser}:${creds.wpAppPassword}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

function yoastFromHead(json: Record<string, unknown> | undefined, url: string, kind: SeoRecord['kind'], source: string): SeoRecord | null {
  if (!json) return null;
  const path = pathFromUrl(url);
  const title = typeof json.title === 'string' ? json.title : undefined;
  const desc = typeof json.description === 'string' ? json.description : undefined;
  const robots = json.robots as { index?: string; follow?: string } | undefined;
  const canonical = typeof json.canonical === 'string' ? json.canonical : undefined;
  return {
    id: `${source}:${path}`,
    kind,
    url,
    path,
    slug: slugFromPath(path),
    status: 'publish',
    seoTitle: title,
    metaDescription: desc,
    canonicalUrl: canonical,
    ogTitle: typeof json.og_title === 'string' ? json.og_title : undefined,
    ogDescription: typeof json.og_description === 'string' ? json.og_description : undefined,
    ogImage: Array.isArray(json.og_image) ? String((json.og_image as { url?: string }[])[0]?.url || '') || undefined : typeof json.og_image === 'string' ? json.og_image : undefined,
    noindex: robots?.index === 'noindex',
    nofollow: robots?.follow === 'nofollow',
    schemaJsonLd: typeof json.schema === 'object' ? JSON.stringify(json.schema) : undefined,
    sources: { url: source, seoTitle: source, metaDescription: source, canonicalUrl: canonical ? source : undefined },
  };
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function collectSitemapUrls(fetchFn: FetchFn, origin: string, detects: ConnectorDetect[]): Promise<string[]> {
  const urls = new Set<string>();
  const robots = await getText(fetchFn, `${origin}/robots.txt`);
  const sitemapUrls: string[] = [];
  if (robots.ok) {
    for (const line of robots.text.split(/\r?\n/)) {
      const m = /^sitemap:\s*(\S+)/i.exec(line.trim());
      if (m) sitemapUrls.push(m[1]);
    }
  }
  if (!sitemapUrls.length) sitemapUrls.push(`${origin}/wp-sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap.xml`);

  for (const sm of sitemapUrls.slice(0, 3)) {
    const res = await getText(fetchFn, sm);
    if (!res.ok || !res.text.includes('<loc')) continue;
    detects.push({ id: 'sitemap-live', name: 'Sitemap trouvé', found: true, detail: sm });
    const locs = [...res.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
    const childMaps = locs.filter((u) => /\.xml(\?|$)/i.test(u)).slice(0, 8);
    for (const p of locs.filter((u) => !/\.xml(\?|$)/i.test(u))) urls.add(p);
    if (childMaps.length) {
      const subs = await mapPool(childMaps, 4, async (child) => getText(fetchFn, child));
      for (const sub of subs) {
        if (!sub.ok) continue;
        for (const m of sub.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
          const u = m[1].trim();
          if (!/\.xml(\?|$)/i.test(u)) urls.add(u);
        }
      }
    }
    break;
  }
  return [...urls];
}

async function restCollection(
  fetchFn: FetchFn,
  origin: string,
  path: string,
  kind: SeoRecord['kind'],
  creds: RemoteCreds | undefined,
  detects: ConnectorDetect[],
  source: string,
  maxPages = 5
): Promise<SeoRecord[]> {
  const headers = authHeader(creds);
  const out: SeoRecord[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${origin}/wp-json/wp/v2/${path}?per_page=100&page=${page}&_fields=link,slug,status,title,yoast_head_json`;
    const res = await getText(fetchFn, url, headers ? { headers } : undefined);
    if (!res.ok) {
      if (page === 1 && (res.status === 401 || res.status === 403)) {
        detects.push({
          id: 'wp-rest-auth',
          name: 'WordPress (identifiants)',
          found: false,
          detail: 'Mot de passe d’application incorrect ou manquant',
        });
      }
      break;
    }
    let items: unknown;
    try {
      items = JSON.parse(res.text);
    } catch {
      break;
    }
    if (!Array.isArray(items) || !items.length) break;
    if (page === 1) detects.push({ id: `wp-rest-${path}`, name: `WordPress · ${path}`, found: true });
    for (const item of items as Record<string, unknown>[]) {
      const link = String(item.link || '');
      if (!link) continue;
      const yoast = yoastFromHead(item.yoast_head_json as Record<string, unknown> | undefined, link, kind, source);
      if (yoast) {
        if (item.status === 'draft') yoast.status = 'draft';
        out.push(yoast);
        continue;
      }
      const titleObj = item.title as { rendered?: string } | undefined;
      out.push({
        id: `rest:${pathFromUrl(link)}`,
        kind,
        url: link,
        path: pathFromUrl(link),
        slug: String(item.slug || slugFromPath(pathFromUrl(link))),
        status: item.status === 'draft' ? 'draft' : 'publish',
        title: titleObj?.rendered?.replace(/<[^>]+>/g, ''),
        seoTitle: titleObj?.rendered?.replace(/<[^>]+>/g, ''),
        sources: { url: source, seoTitle: source },
      });
    }
    if (items.length < 100) break;
  }
  return out;
}

async function ftpPull(ftp: FtpFn, creds: NonNullable<RemoteCreds['ftp']>, detects: ConnectorDetect[]): Promise<UploadedFile[]> {
  const root = (creds.root || '/').replace(/\/$/, '') || '';
  const candidates = [`${root}/.htaccess`, `${root}/robots.txt`];
  const files: UploadedFile[] = [];
  try {
    await Promise.race([
      ftp.list({ ...creds, path: root || '/' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('FTP trop lent')), 10_000)),
    ]);
    detects.push({ id: 'ftp', name: 'FTP connecté', found: true, detail: creds.host });
  } catch (e) {
    detects.push({ id: 'ftp', name: 'FTP', found: false, detail: e instanceof Error ? e.message : 'échec' });
    return files;
  }
  for (const path of candidates) {
    try {
      const text = await Promise.race([
        ftp.readText({ ...creds, path, maxBytes: 500_000 }),
        new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8_000)),
      ]);
      if (text.trim()) files.push({ name: path.split('/').pop() || 'ftp.txt', mimeType: 'text/plain', content: text, encoding: 'utf8' });
    } catch {
      /* absent */
    }
  }
  return files;
}

export async function remoteAutoAnalyze(opts: {
  siteUrl: string;
  fetch: FetchFn;
  ftp?: FtpFn;
  creds?: RemoteCreds;
  maxCrawl?: number;
  onProgress?: ProgressFn;
}): Promise<{
  detects: ConnectorDetect[];
  records: SeoRecord[];
  redirects: RedirectRecord[];
  warnings: string[];
  filesFromRemote: UploadedFile[];
}> {
  const origin = originOf(opts.siteUrl);
  const detects: ConnectorDetect[] = [];
  const warnings: string[] = [];
  const filesFromRemote: UploadedFile[] = [];
  const parts: { records: SeoRecord[]; redirects: RedirectRecord[]; warnings: string[] }[] = [];
  const progress = opts.onProgress || (() => undefined);

  await progress('Connexion à votre site…', 5);
  const home = await getText(opts.fetch, origin + '/');
  if (!home.ok && home.status === 0) {
    throw new Error(
      `Impossible de joindre ${origin}. Vérifiez l’adresse (avec https://) et que le site est accessible depuis Internet.`
    );
  }
  if (home.ok) {
    detects.push({ id: 'site-live', name: 'Site joignable', found: true, detail: origin });
    parts.push({ records: [recordFromHtml(home.text, origin + '/', 'crawl-live')], redirects: [], warnings: [] });
  }

  await progress('Lecture de l’API WordPress…', 20);
  const [restPages, restPosts, restProducts] = await Promise.all([
    restCollection(opts.fetch, origin, 'pages', 'page', opts.creds, detects, 'wp-rest', 8),
    restCollection(opts.fetch, origin, 'posts', 'post', opts.creds, detects, 'wp-rest', 8),
    restCollection(opts.fetch, origin, 'products', 'product', opts.creds, detects, 'wp-rest', 4),
  ]);
  const restAll = [...restPages, ...restPosts, ...restProducts];
  if (restAll.length) {
    parts.push({ records: restAll, redirects: [], warnings: [] });
  } else if (!opts.creds?.wpAppPassword) {
    warnings.push('Pour un résultat plus complet : ajoutez un mot de passe d’application WordPress (Options avancées).');
  } else {
    warnings.push('L’API WordPress n’a pas répondu avec ces identifiants. On continue via le sitemap.');
  }

  await progress('Lecture du plan du site (sitemap)…', 45);
  const sitemapUrls = await collectSitemapUrls(opts.fetch, origin, detects);

  // Crawl HTML seulement pour combler les trous (pas toutes les URLs)
  const known = new Set(parts.flatMap((p) => p.records.map((r) => r.path)));
  const maxCrawl = restAll.length >= 30 ? Math.min(opts.maxCrawl ?? 15, 20) : Math.min(opts.maxCrawl ?? 40, 50);
  const toCrawl = sitemapUrls
    .filter((u) => u.startsWith(origin) && !known.has(pathFromUrl(u)))
    .slice(0, maxCrawl);

  if (toCrawl.length) {
    await progress(`Analyse de ${toCrawl.length} pages…`, 60);
    detects.push({ id: 'crawl-live', name: 'Pages lues', found: true, detail: `${toCrawl.length}` });
    const crawled = await mapPool(toCrawl, 6, async (u) => {
      const res = await getText(opts.fetch, u);
      if (!res.ok || !/<html|<!doctype/i.test(res.text.slice(0, 400))) return null;
      return recordFromHtml(res.text, u, 'crawl-live');
    });
    const ok = crawled.filter(Boolean) as SeoRecord[];
    if (ok.length) parts.push({ records: ok, redirects: [], warnings: [] });
  }

  if (opts.ftp && opts.creds?.ftp?.host && opts.creds.ftp.user) {
    await progress('Connexion FTP (fichiers serveur)…', 85);
    const ftpFiles = await ftpPull(opts.ftp, opts.creds.ftp, detects);
    filesFromRemote.push(...ftpFiles);
  }

  await progress('Préparation du rapport…', 95);
  const merged = mergeRecords(parts);
  if (!merged.records.length && !merged.redirects.length && !filesFromRemote.length) {
    throw new Error(
      'Aucune donnée SEO trouvée. Vérifiez l’URL, ou renseignez un mot de passe d’application / FTP dans Options avancées.'
    );
  }

  return {
    detects: [
      ...detects,
      { id: 'auto', name: 'Analyse automatique', found: merged.records.length > 0, detail: `${merged.records.length} contenus` },
    ],
    records: merged.records,
    redirects: merged.redirects,
    warnings: [...warnings, ...merged.warnings],
    filesFromRemote,
  };
}
