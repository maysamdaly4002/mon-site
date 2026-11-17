import type { AnalyzeContext, ConnectorDetect, ExtractResult, SeoConnector, SeoRecord, RedirectRecord } from '../types';
import { pickTextFiles } from './utils';
import { wxrConnector } from './wxr';
import { yoastCsvConnector } from './yoastCsv';
import { rankMathCsvConnector } from './rankMathCsv';
import { redirectionConnector } from './redirection';
import { exporterConnector } from './exporter';
import {
  aioseoCsvConnector,
  seopressCsvConnector,
  tsfCsvConnector,
  slimSeoCsvConnector,
  screamingFrogConnector,
} from './pluginCsv';
import { htaccessConnector } from './htaccess';
import { sitemapConnector } from './sitemap';
import { gscCsvConnector } from './gscCsv';
import { htmlCrawlerConnector } from './htmlCrawler';

export const CONNECTORS: SeoConnector[] = [
  exporterConnector,
  wxrConnector,
  yoastCsvConnector,
  rankMathCsvConnector,
  aioseoCsvConnector,
  seopressCsvConnector,
  tsfCsvConnector,
  slimSeoCsvConnector,
  screamingFrogConnector,
  redirectionConnector,
  htaccessConnector,
  sitemapConnector,
  gscCsvConnector,
  htmlCrawlerConnector,
];

const RICHNESS: (keyof SeoRecord)[] = [
  'seoTitle',
  'metaDescription',
  'focusKeyphrase',
  'canonicalUrl',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'schemaJsonLd',
  'schemaType',
  'breadcrumbsTitle',
];

function richer(a: unknown, b: unknown): boolean {
  const sa = typeof a === 'string' ? a.trim().length : a == null ? 0 : 1;
  const sb = typeof b === 'string' ? b.trim().length : b == null ? 0 : 1;
  return sb > sa;
}

/** Fusion par chemin : la valeur la plus riche gagne, sources tracées. */
export function mergeRecords(parts: ExtractResult[]): { records: SeoRecord[]; redirects: RedirectRecord[]; warnings: string[] } {
  const byPath = new Map<string, SeoRecord>();
  const redirs = new Map<string, RedirectRecord>();
  const warnings: string[] = [];
  for (const part of parts) {
    warnings.push(...part.warnings);
    for (const r of part.records) {
      const key = r.path || r.url;
      const cur = byPath.get(key);
      if (!cur) {
        byPath.set(key, { ...r, sources: { ...r.sources } });
        continue;
      }
      const next = { ...cur };
      for (const field of RICHNESS) {
        const incoming = r[field];
        if (incoming == null || incoming === '') continue;
        if (richer(cur[field], incoming)) {
          (next as Record<string, unknown>)[field] = incoming;
          if (r.sources[field as keyof typeof r.sources]) {
            next.sources = { ...next.sources, [field]: r.sources[field as keyof typeof r.sources] };
          }
        } else if (cur[field] == null || cur[field] === '') {
          (next as Record<string, unknown>)[field] = incoming;
          next.sources = { ...next.sources, ...(r.sources || {}) };
        }
      }
      if (r.noindex) next.noindex = true;
      if (r.nofollow) next.nofollow = true;
      if (r.hreflang?.length) next.hreflang = [...(next.hreflang || []), ...r.hreflang];
      if (r.imageAlts?.length) next.imageAlts = [...(next.imageAlts || []), ...r.imageAlts];
      if (!next.title && r.title) next.title = r.title;
      if (next.kind === 'other' && r.kind !== 'other') next.kind = r.kind;
      byPath.set(key, next);
    }
    for (const re of part.redirects) {
      if (!redirs.has(re.from)) redirs.set(re.from, re);
    }
  }
  return { records: [...byPath.values()], redirects: [...redirs.values()], warnings };
}

export function runConnectors(files: AnalyzeContext['files'], siteUrl?: string) {
  const textFiles = pickTextFiles(files);
  const ctx: AnalyzeContext = { siteUrl, files, textFiles };
  const detects: ConnectorDetect[] = CONNECTORS.map((c) => c.detect(ctx));
  const parts: ExtractResult[] = [];
  for (const c of CONNECTORS) {
    if (!detects.find((d) => d.id === c.id)?.found) continue;
    parts.push(c.extract(ctx) as ExtractResult);
  }
  if (!parts.length && textFiles.length) {
    for (const c of CONNECTORS) parts.push(c.extract(ctx) as ExtractResult);
  }
  const merged = mergeRecords(parts);
  return { detects, ...merged };
}
