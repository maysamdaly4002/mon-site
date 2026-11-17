/**
 * Fabrique de connecteurs CSV SEO (Yoast-like, AIOSEO, SEOPress, Screaming Frog…).
 * Gabarit réutilisable pour la communauté (groupe G).
 */
import type { AnalyzeContext, ExtractResult, SeoConnector, SeoField, SeoRecord } from '../types';
import { csvIdx, parseCsv, pathFromUrl, slugFromPath } from './utils';

export type CsvColumnMap = {
  url: string[];
  seoTitle?: string[];
  metaDescription?: string[];
  focusKeyphrase?: string[];
  canonicalUrl?: string[];
  ogTitle?: string[];
  ogDescription?: string[];
  ogImage?: string[];
  noindex?: string[];
};

export function createCsvSeoConnector(opts: {
  id: string;
  name: string;
  /** Indices / noms de colonnes */
  columns: CsvColumnMap;
  /** Détection : noms de fichier ou en-têtes attendus */
  detectHints: string[];
  fields?: SeoField[];
}): SeoConnector {
  const fields: SeoField[] = opts.fields || [
    'url',
    'seoTitle',
    'metaDescription',
    'focusKeyphrase',
    'canonicalUrl',
    'ogTitle',
    'ogDescription',
    'ogImage',
    'noindex',
  ];

  return {
    id: opts.id,
    name: opts.name,
    fields,
    detect: (ctx) => {
      const hit = ctx.textFiles.some((f) => {
        const head = f.text.slice(0, 600).toLowerCase();
        const name = f.name.toLowerCase();
        return opts.detectHints.some((h) => name.includes(h) || head.includes(h));
      });
      return { id: opts.id, name: opts.name, found: hit };
    },
    extract: (ctx: AnalyzeContext): ExtractResult => {
      const records: SeoRecord[] = [];
      const warnings: string[] = [];
      for (const f of ctx.textFiles) {
        if (!f.name.endsWith('.csv') && !f.text.includes(',')) continue;
        const rows = parseCsv(f.text);
        if (rows.length < 2) continue;
        const header = rows[0];
        const iUrl = csvIdx(header, ...opts.columns.url);
        if (iUrl < 0) continue;
        const iTitle = opts.columns.seoTitle ? csvIdx(header, ...opts.columns.seoTitle) : -1;
        const iDesc = opts.columns.metaDescription ? csvIdx(header, ...opts.columns.metaDescription) : -1;
        const iKw = opts.columns.focusKeyphrase ? csvIdx(header, ...opts.columns.focusKeyphrase) : -1;
        const iCanon = opts.columns.canonicalUrl ? csvIdx(header, ...opts.columns.canonicalUrl) : -1;
        const iOgT = opts.columns.ogTitle ? csvIdx(header, ...opts.columns.ogTitle) : -1;
        const iOgD = opts.columns.ogDescription ? csvIdx(header, ...opts.columns.ogDescription) : -1;
        const iOgI = opts.columns.ogImage ? csvIdx(header, ...opts.columns.ogImage) : -1;
        const iNo = opts.columns.noindex ? csvIdx(header, ...opts.columns.noindex) : -1;

        for (const r of rows.slice(1)) {
          const url = (r[iUrl] || '').trim();
          if (!url) continue;
          const path = pathFromUrl(url);
          const noRaw = iNo >= 0 ? (r[iNo] || '').toLowerCase() : '';
          records.push({
            id: `${opts.id}:${path}`,
            kind: 'other',
            url,
            path,
            slug: slugFromPath(path),
            status: 'publish',
            seoTitle: iTitle >= 0 ? r[iTitle] || undefined : undefined,
            metaDescription: iDesc >= 0 ? r[iDesc] || undefined : undefined,
            focusKeyphrase: iKw >= 0 ? r[iKw] || undefined : undefined,
            canonicalUrl: iCanon >= 0 ? r[iCanon] || undefined : undefined,
            ogTitle: iOgT >= 0 ? r[iOgT] || undefined : undefined,
            ogDescription: iOgD >= 0 ? r[iOgD] || undefined : undefined,
            ogImage: iOgI >= 0 ? r[iOgI] || undefined : undefined,
            noindex: noRaw === '1' || noRaw === 'true' || noRaw === 'yes' || noRaw === 'noindex',
            sources: {
              url: opts.id,
              seoTitle: iTitle >= 0 ? opts.id : undefined,
              metaDescription: iDesc >= 0 ? opts.id : undefined,
              focusKeyphrase: iKw >= 0 ? opts.id : undefined,
              canonicalUrl: iCanon >= 0 ? opts.id : undefined,
            },
          });
        }
      }
      if (!records.length) warnings.push(`${opts.name} : aucune ligne URL trouvée`);
      return { records, redirects: [], warnings };
    },
  };
}
