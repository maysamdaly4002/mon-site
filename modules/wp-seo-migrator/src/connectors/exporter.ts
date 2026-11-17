/**
 * JSON produit par le plugin WordPress « Snapify Exporter ».
 * Format : { format: 'snapify-wp-seo/1', site, plugins, records, redirects }
 */
import type { AnalyzeContext, ExtractResult, RedirectRecord, SeoConnector, SeoRecord } from '../types';
import { pathFromUrl, safeJson, slugFromPath } from './utils';

type ExporterPayload = {
  format?: string;
  site?: { url?: string };
  plugins?: { id: string; name: string; active?: boolean }[];
  records?: Partial<SeoRecord>[];
  redirects?: { from: string; to: string; permanent?: boolean }[];
};

export const exporterConnector: SeoConnector = {
  id: 'snapify-exporter',
  name: 'Plugin Snapify Exporter',
  fields: [
    'url',
    'slug',
    'seoTitle',
    'metaDescription',
    'focusKeyphrase',
    'canonicalUrl',
    'noindex',
    'nofollow',
    'ogTitle',
    'ogDescription',
    'ogImage',
    'schemaJsonLd',
    'hreflang',
    'redirects',
  ],
  detect: (ctx) => {
    const hit = ctx.textFiles.some((f) => {
      const j = safeJson<ExporterPayload>(f.text);
      return j?.format === 'snapify-wp-seo/1' || (Array.isArray(j?.records) && Array.isArray(j?.plugins));
    });
    return {
      id: 'snapify-exporter',
      name: 'Plugin Snapify Exporter',
      found: hit,
      detail: hit ? 'Export Snapify complet détecté' : undefined,
    };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const records: SeoRecord[] = [];
    const redirects: RedirectRecord[] = [];
    const warnings: string[] = [];
    for (const f of ctx.textFiles) {
      const j = safeJson<ExporterPayload>(f.text);
      if (!j || (j.format !== 'snapify-wp-seo/1' && !j.records)) continue;
      for (const r of j.records || []) {
        const url = String(r.url || '');
        const path = r.path || pathFromUrl(url);
        records.push({
          id: String(r.id || `exp:${path}`),
          kind: (r.kind as SeoRecord['kind']) || 'other',
          url: url || path,
          path,
          slug: r.slug || slugFromPath(path),
          status: (r.status as SeoRecord['status']) || 'publish',
          title: r.title,
          seoTitle: r.seoTitle,
          metaDescription: r.metaDescription,
          focusKeyphrase: r.focusKeyphrase,
          canonicalUrl: r.canonicalUrl,
          noindex: !!r.noindex,
          nofollow: !!r.nofollow,
          ogTitle: r.ogTitle,
          ogDescription: r.ogDescription,
          ogImage: r.ogImage,
          twitterCard: r.twitterCard || 'summary_large_image',
          schemaType: r.schemaType,
          schemaJsonLd: r.schemaJsonLd,
          hreflang: r.hreflang,
          breadcrumbsTitle: r.breadcrumbsTitle,
          imageAlts: r.imageAlts,
          sources: { ...(r.sources || {}), url: 'snapify-exporter' },
        });
      }
      for (const re of j.redirects || []) {
        redirects.push({
          id: `exp-redir:${re.from}`,
          from: pathFromUrl(re.from),
          to: re.to.startsWith('http') ? re.to : pathFromUrl(re.to),
          permanent: re.permanent !== false,
          source: 'snapify-exporter',
        });
      }
    }
    if (!records.length && !redirects.length) warnings.push('Export Snapify vide ou illisible');
    return { records, redirects, warnings };
  },
};
