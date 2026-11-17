/** Groupe F — index / sous-sitemaps XML (URLs à prioriser) */
import type { AnalyzeContext, ExtractResult, SeoConnector, SeoRecord } from '../types';
import { pathFromUrl, slugFromPath } from './utils';

export const sitemapConnector: SeoConnector = {
  id: 'sitemap',
  name: 'Sitemap XML',
  fields: ['url', 'slug'],
  detect: (ctx) => {
    const hit = ctx.textFiles.some(
      (f) =>
        f.name.includes('sitemap') ||
        f.text.includes('<urlset') ||
        f.text.includes('<sitemapindex')
    );
    return { id: 'sitemap', name: 'Sitemap XML', found: hit };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const records: SeoRecord[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    for (const f of ctx.textFiles) {
      if (!(f.text.includes('<url') || f.text.includes('<sitemap'))) continue;
      const locs = [...f.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
      for (const url of locs) {
        if (url.endsWith('.xml')) continue; // index entry — pas une page
        const path = pathFromUrl(url);
        if (seen.has(path)) continue;
        seen.add(path);
        records.push({
          id: `sitemap:${path}`,
          kind: path.includes('/product') ? 'product' : path.includes('/category') || path.includes('/tag') ? 'term' : 'other',
          url,
          path,
          slug: slugFromPath(path),
          status: 'publish',
          sources: { url: 'sitemap' },
        });
      }
    }
    if (!records.length) warnings.push('Sitemap : aucune URL <loc> trouvée');
    return { records, redirects: [], warnings };
  },
};
