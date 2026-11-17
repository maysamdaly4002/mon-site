/** CSV Rank Math export */
import type { AnalyzeContext, ExtractResult, SeoConnector, SeoRecord } from '../types';
import { pathFromUrl, slugFromPath } from './utils';

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const cols: string[] = [];
      let cur = '';
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) {
          if (c === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (c === '"') q = false;
          else cur += c;
        } else if (c === '"') q = true;
        else if (c === ',') {
          cols.push(cur);
          cur = '';
        } else cur += c;
      }
      cols.push(cur);
      return cols;
    });
}

export const rankMathCsvConnector: SeoConnector = {
  id: 'rankmath-csv',
  name: 'Rank Math (CSV)',
  fields: ['url', 'seoTitle', 'metaDescription', 'focusKeyphrase', 'canonicalUrl', 'schemaType'],
  detect: (ctx) => {
    const hit = ctx.textFiles.some((f) => {
      const h = f.text.slice(0, 500).toLowerCase();
      return h.includes('rank_math') || h.includes('rank math') || (f.name.includes('rank') && f.name.endsWith('.csv'));
    });
    return { id: 'rankmath-csv', name: 'Rank Math (CSV)', found: hit };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const records: SeoRecord[] = [];
    for (const f of ctx.textFiles) {
      const head = f.text.slice(0, 300).toLowerCase();
      if (!(head.includes('rank') || f.name.includes('rank'))) continue;
      const rows = parseCsv(f.text);
      if (rows.length < 2) continue;
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const col = (...names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
      const iUrl = col('url', 'permalink', 'link');
      const iTitle = col('title', 'seo title', 'rank_math_title');
      const iDesc = col('description', 'meta description', 'rank_math_description');
      const iKw = col('focus keyword', 'focus_keyword', 'keyword');
      if (iUrl < 0) continue;
      for (const r of rows.slice(1)) {
        const url = (r[iUrl] || '').trim();
        if (!url) continue;
        const path = pathFromUrl(url);
        records.push({
          id: `rankmath-csv:${path}`,
          kind: 'other',
          url,
          path,
          slug: slugFromPath(path),
          status: 'publish',
          seoTitle: iTitle >= 0 ? r[iTitle] : undefined,
          metaDescription: iDesc >= 0 ? r[iDesc] : undefined,
          focusKeyphrase: iKw >= 0 ? r[iKw] : undefined,
          sources: { url: 'rankmath-csv', seoTitle: 'rankmath-csv', metaDescription: 'rankmath-csv' },
        });
      }
    }
    return { records, redirects: [], warnings: [] };
  },
};
