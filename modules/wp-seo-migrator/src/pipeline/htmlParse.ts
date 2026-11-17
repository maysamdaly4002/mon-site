/** Parse SEO depuis HTML rendu (crawl live ou fichier). */
import type { SeoRecord } from '../types';
import { pathFromUrl, slugFromPath, stripTags } from '../connectors/utils';

export function meta(html: string, name: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i');
  return re.exec(html)?.[1] || re2.exec(html)?.[1];
}

export function linkRel(html: string, rel: string): string | undefined {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`, 'i');
  return re.exec(html)?.[1] || re2.exec(html)?.[1];
}

export function recordFromHtml(html: string, fallbackUrl: string, source: string): SeoRecord {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
  const canonical = linkRel(html, 'canonical');
  const url = canonical || meta(html, 'og:url') || fallbackUrl;
  const path = pathFromUrl(url);
  const robots = (meta(html, 'robots') || '').toLowerCase();
  const jsonLds = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
  const hreflang = [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi)].map((m) => ({
    lang: m[1],
    url: m[2],
  }));
  const alts = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/gi)].map((m) => ({ src: m[1], alt: m[2] }));
  return {
    id: `${source}:${path}`,
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
      url: source,
      seoTitle: source,
      metaDescription: source,
      canonicalUrl: canonical ? source : undefined,
      schemaJsonLd: jsonLds[0] ? source : undefined,
    },
  };
}
