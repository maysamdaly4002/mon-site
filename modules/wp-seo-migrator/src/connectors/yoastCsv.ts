/** CSV export Yoast / Screaming Frog-like with yoast columns */
import type { AnalyzeContext, ExtractResult, SeoConnector, SeoRecord } from '../types';
import { csvIdx, parseCsv, pathFromUrl, slugFromPath } from './utils';

export const yoastCsvConnector: SeoConnector = {
  id: 'yoast-csv',
  name: 'Yoast (CSV)',
  fields: ['url', 'seoTitle', 'metaDescription', 'focusKeyphrase', 'canonicalUrl'],
  detect: (ctx) => {
    const hit = ctx.textFiles.some((f) => {
      const h = f.text.slice(0, 400).toLowerCase();
      return h.includes('seo title') || h.includes('meta description') || h.includes('_yoast') || (h.includes('title') && h.includes('url') && f.name.includes('yoast'));
    });
    return { id: 'yoast-csv', name: 'Yoast (CSV)', found: hit };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const records: SeoRecord[] = [];
    const warnings: string[] = [];
    for (const f of ctx.textFiles) {
      if (!f.name.endsWith('.csv') && !f.text.includes(',')) continue;
      const rows = parseCsv(f.text);
      if (rows.length < 2) continue;
      const header = rows[0];
      const iUrl = csvIdx(header, 'url', 'address', 'permalink', 'lien');
      const iTitle = csvIdx(header, 'seo title', 'title', 'titre seo', 'meta title');
      const iDesc = csvIdx(header, 'meta description', 'description', 'meta desc');
      const iKw = csvIdx(header, 'keyphrase', 'focus keyphrase', 'keyword', 'mot-clé');
      const iCanon = csvIdx(header, 'canonical', 'canonical url');
      if (iUrl < 0) continue;
      for (const r of rows.slice(1)) {
        const url = (r[iUrl] || '').trim();
        if (!url) continue;
        const path = pathFromUrl(url);
        records.push({
          id: `yoast-csv:${path}`,
          kind: 'other',
          url,
          path,
          slug: slugFromPath(path),
          status: 'publish',
          seoTitle: iTitle >= 0 ? r[iTitle] : undefined,
          metaDescription: iDesc >= 0 ? r[iDesc] : undefined,
          focusKeyphrase: iKw >= 0 ? r[iKw] : undefined,
          canonicalUrl: iCanon >= 0 ? r[iCanon] : undefined,
          sources: {
            url: 'yoast-csv',
            seoTitle: iTitle >= 0 ? 'yoast-csv' : undefined,
            metaDescription: iDesc >= 0 ? 'yoast-csv' : undefined,
          },
        });
      }
    }
    if (!records.length) warnings.push('CSV Yoast : aucune ligne URL trouvée');
    return { records, redirects: [], warnings };
  },
};
