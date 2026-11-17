/**
 * Groupe F — crawler de secours hors-ligne : HTML déjà téléversé (rendu).
 * Title, meta, canonical, OG, Twitter, JSON-LD, hreflang.
 * (Crawl live HTTP = lacune SDK net:hôte — voir ARCHITECTURE.md)
 */
import type { AnalyzeContext, ExtractResult, SeoConnector, SeoRecord } from '../types';
import { pathFromUrl, slugFromPath, stripTags } from './utils';

function meta(html: string, name: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i');
  return re.exec(html)?.[1] || re2.exec(html)?.[1];
}

function linkRel(html: string, rel: string): string | undefined {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`, 'i');
  return re.exec(html)?.[1] || re2.exec(html)?.[1];
}

export const htmlCrawlerConnector: SeoConnector = {
  id: 'html-crawler',
  name: 'HTML rendu (secours)',
  fields: ['url', 'seoTitle', 'metaDescription', 'canonicalUrl', 'ogTitle', 'ogDescription', 'ogImage', 'schemaJsonLd', 'hreflang', 'noindex'],
  detect: (ctx) => {
    const hit = ctx.textFiles.some((f) => {
      const n = f.name.toLowerCase();
      const t = f.text.slice(0, 300).toLowerCase();
      return n.endsWith('.html') || n.endsWith('.htm') || t.includes('<html') || t.includes('<!doctype html');
    });
    return { id: 'html-crawler', name: 'HTML rendu (secours)', found: hit };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const records: SeoRecord[] = [];
    const warnings: string[] = [];
    for (const f of ctx.textFiles) {
      const html = f.text;
      if (!/<html|<!doctype html/i.test(html.slice(0, 500))) continue;
      const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
      const canonical = linkRel(html, 'canonical');
      const url =
        canonical ||
        meta(html, 'og:url') ||
        `https://imported.local/${f.name.replace(/\.html?$/i, '')}`;
      const path = pathFromUrl(url);
      const robots = (meta(html, 'robots') || '').toLowerCase();
      const jsonLds = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) =>
        m[1].trim()
      );
      const hreflang = [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi)].map(
        (m) => ({ lang: m[1], url: m[2] })
      );
      const alts = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/gi)].map((m) => ({
        src: m[1],
        alt: m[2],
      }));
      records.push({
        id: `html:${path}`,
        kind: 'other',
        url,
        path,
        slug: slugFromPath(path),
        status: 'publish',
        title: title ? stripTags(title) : undefined,
        seoTitle: title ? stripTags(title) : undefined,
        metaDescription: meta(html, 'description'),
        canonicalUrl: canonical,
        ogTitle: meta(html, 'og:title'),
        ogDescription: meta(html, 'og:description'),
        ogImage: meta(html, 'og:image'),
        twitterCard: (meta(html, 'twitter:card') as 'summary' | 'summary_large_image' | undefined) || undefined,
        schemaJsonLd: jsonLds[0],
        schemaType: jsonLds[0]?.includes('Product') ? 'Product' : jsonLds[0]?.includes('Article') ? 'Article' : undefined,
        hreflang: hreflang.length ? hreflang : undefined,
        imageAlts: alts.length ? alts : undefined,
        noindex: robots.includes('noindex'),
        nofollow: robots.includes('nofollow'),
        sources: {
          url: 'html-crawler',
          seoTitle: 'html-crawler',
          metaDescription: 'html-crawler',
          canonicalUrl: canonical ? 'html-crawler' : undefined,
          schemaJsonLd: jsonLds[0] ? 'html-crawler' : undefined,
        },
      });
    }
    if (!records.length) warnings.push('HTML : aucun fichier de page détecté');
    return { records, redirects: [], warnings };
  },
};
