/** Groupe F — Google Search Console (CSV) pour prioriser les URLs à fort trafic */
import type { AnalyzeContext, ExtractResult, SeoConnector, SeoRecord } from '../types';
import { csvIdx, parseCsv, pathFromUrl, slugFromPath } from './utils';

export const gscCsvConnector: SeoConnector = {
  id: 'gsc-csv',
  name: 'Google Search Console (CSV)',
  fields: ['url'],
  detect: (ctx) => {
    const hit = ctx.textFiles.some((f) => {
      const h = f.text.slice(0, 400).toLowerCase();
      const n = f.name.toLowerCase();
      return n.includes('gsc') || n.includes('search-console') || (h.includes('clicks') && h.includes('impressions') && (h.includes('top pages') || h.includes('page') || h.includes('url')));
    });
    return { id: 'gsc-csv', name: 'Google Search Console (CSV)', found: hit };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const records: SeoRecord[] = [];
    const warnings: string[] = [];
    for (const f of ctx.textFiles) {
      if (!f.name.endsWith('.csv') && !f.text.includes(',')) continue;
      const rows = parseCsv(f.text);
      if (rows.length < 2) continue;
      const header = rows[0];
      const iUrl = csvIdx(header, 'top pages', 'page', 'url', 'landing page');
      const iClicks = csvIdx(header, 'clicks', 'clics');
      if (iUrl < 0) continue;
      const scored: { path: string; url: string; clicks: number }[] = [];
      for (const r of rows.slice(1)) {
        const url = (r[iUrl] || '').trim();
        if (!url) continue;
        const clicks = iClicks >= 0 ? Number(r[iClicks]) || 0 : 0;
        scored.push({ url, path: pathFromUrl(url), clicks });
      }
      scored.sort((a, b) => b.clicks - a.clicks);
      for (const s of scored) {
        records.push({
          id: `gsc:${s.path}`,
          kind: 'other',
          url: s.url,
          path: s.path,
          slug: slugFromPath(s.path),
          status: 'publish',
          // focusKeyphrase détourné : stocke un hint de priorité lisible
          focusKeyphrase: s.clicks > 0 ? `gsc-clicks:${s.clicks}` : undefined,
          sources: { url: 'gsc-csv', focusKeyphrase: s.clicks > 0 ? 'gsc-csv' : undefined },
        });
      }
    }
    if (!records.length) warnings.push('GSC : aucune page dans le CSV');
    return { records, redirects: [], warnings };
  },
};
