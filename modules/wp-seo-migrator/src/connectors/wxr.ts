/**
 * Connecteur WXR (export WordPress XML) — titres, liens, meta postmeta Yoast/Rank Math.
 */
import type { AnalyzeContext, ExtractResult, RedirectRecord, SeoConnector, SeoRecord } from '../types';
import { pathFromUrl, slugFromPath, stripTags } from './utils';

function metaMap(itemXml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<wp:postmeta>[\s\S]*?<wp:meta_key><!\[CDATA\[(.*?)\]\]><\/wp:meta_key>[\s\S]*?<wp:meta_value><!\[CDATA\[([\s\S]*?)\]\]><\/wp:meta_value>[\s\S]*?<\/wp:postmeta>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(itemXml))) out[m[1]] = m[2];
  // fallback without CDATA
  const re2 =
    /<wp:meta_key>([^<]+)<\/wp:meta_key>[\s\S]*?<wp:meta_value>([\s\S]*?)<\/wp:meta_value>/gi;
  while ((m = re2.exec(itemXml))) {
    const k = m[1].trim();
    if (!out[k]) out[k] = stripTags(m[2]);
  }
  return out;
}

function tag(xml: string, name: string): string {
  const cdata = xml.match(new RegExp(`<${name}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${name}>`, 'i'));
  if (cdata) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return plain ? stripTags(plain[1]) : '';
}

function parseItems(xml: string): SeoRecord[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const records: SeoRecord[] = [];
  for (const item of items) {
    const postType = tag(item, 'wp:post_type') || 'post';
    if (!['post', 'page', 'product'].includes(postType)) continue;
    const statusRaw = tag(item, 'wp:status') || 'publish';
    const link = tag(item, 'link');
    const title = tag(item, 'title');
    const path = pathFromUrl(link);
    const meta = metaMap(item);
    const kind = postType === 'page' ? 'page' : postType === 'product' ? 'product' : 'post';
    const sources: SeoRecord['sources'] = { url: 'wxr' };

    const yoastTitle = meta['_yoast_wpseo_title'] || meta['rank_math_title'];
    const yoastDesc = meta['_yoast_wpseo_metadesc'] || meta['rank_math_description'];
    const focus = meta['_yoast_wpseo_focuskw'] || meta['rank_math_focus_keyword'];
    const canonical = meta['_yoast_wpseo_canonical'] || meta['rank_math_canonical_url'];
    const noindex =
      meta['_yoast_wpseo_meta-robots-noindex'] === '1' || meta['rank_math_robots']?.includes('noindex');
    const ogTitle = meta['_yoast_wpseo_opengraph-title'] || meta['rank_math_facebook_title'];
    const ogDesc = meta['_yoast_wpseo_opengraph-description'] || meta['rank_math_facebook_description'];
    const ogImage = meta['_yoast_wpseo_opengraph-image'] || meta['rank_math_facebook_image'];

    if (yoastTitle) sources.seoTitle = meta['_yoast_wpseo_title'] ? 'yoast' : 'rankmath';
    if (yoastDesc) sources.metaDescription = meta['_yoast_wpseo_metadesc'] ? 'yoast' : 'rankmath';
    if (focus) sources.focusKeyphrase = meta['_yoast_wpseo_focuskw'] ? 'yoast' : 'rankmath';
    if (canonical) sources.canonicalUrl = meta['_yoast_wpseo_canonical'] ? 'yoast' : 'rankmath';

    records.push({
      id: `wxr:${tag(item, 'wp:post_id') || path}`,
      kind,
      url: link || path,
      path,
      slug: slugFromPath(path),
      status: statusRaw === 'publish' ? 'publish' : statusRaw === 'draft' ? 'draft' : 'other',
      title,
      seoTitle: yoastTitle || title,
      metaDescription: yoastDesc || undefined,
      focusKeyphrase: focus || undefined,
      canonicalUrl: canonical || undefined,
      noindex: !!noindex,
      nofollow: false,
      ogTitle: ogTitle || undefined,
      ogDescription: ogDesc || undefined,
      ogImage: ogImage || undefined,
      twitterCard: 'summary_large_image',
      schemaType: kind === 'product' ? 'Product' : kind === 'post' ? 'Article' : 'WebPage',
      sources,
    });
  }
  return records;
}

export const wxrConnector: SeoConnector = {
  id: 'wxr',
  name: 'Export WordPress (WXR)',
  fields: ['url', 'slug', 'seoTitle', 'metaDescription', 'focusKeyphrase', 'canonicalUrl', 'noindex', 'ogTitle', 'ogDescription', 'ogImage'],
  detect: (ctx: AnalyzeContext) => {
    const hit = ctx.textFiles.some((f) => f.text.includes('<wp:wxr_version>') || (f.text.includes('<rss') && f.text.includes('xmlns:wp=')));
    return { id: 'wxr', name: 'Export WordPress (WXR)', found: hit, detail: hit ? 'Fichier XML WordPress détecté' : undefined };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const records: SeoRecord[] = [];
    const redirects: RedirectRecord[] = [];
    const warnings: string[] = [];
    for (const f of ctx.textFiles) {
      if (!(f.text.includes('<wp:wxr_version>') || f.text.includes('xmlns:wp='))) continue;
      const part = parseItems(f.text);
      if (!part.length) warnings.push(`Aucune page/article lisible dans ${f.name}`);
      records.push(...part);
    }
    return { records, redirects, warnings };
  },
};
