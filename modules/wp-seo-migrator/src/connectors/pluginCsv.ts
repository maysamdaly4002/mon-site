/** Groupe A + F — exports CSV plugins SEO et crawlers */
import { createCsvSeoConnector } from './csvSeoFactory';

export const aioseoCsvConnector = createCsvSeoConnector({
  id: 'aioseo-csv',
  name: 'All in One SEO (CSV)',
  detectHints: ['aioseo', 'all-in-one-seo', 'all in one seo', '_aioseo'],
  columns: {
    url: ['url', 'permalink', 'address', 'lien'],
    seoTitle: ['title', 'seo title', 'meta title'],
    metaDescription: ['description', 'meta description'],
    focusKeyphrase: ['keyphrases', 'keywords', 'focus keyword'],
    canonicalUrl: ['canonical', 'canonical url'],
    ogTitle: ['og title', 'facebook title'],
    ogDescription: ['og description', 'facebook description'],
    ogImage: ['og image', 'facebook image'],
    noindex: ['robots', 'noindex'],
  },
});

export const seopressCsvConnector = createCsvSeoConnector({
  id: 'seopress-csv',
  name: 'SEOPress (CSV)',
  detectHints: ['seopress', '_seopress'],
  columns: {
    url: ['url', 'permalink', 'address'],
    seoTitle: ['title', 'meta title', 'seopress_titles_title'],
    metaDescription: ['description', 'meta description', 'seopress_titles_desc'],
    focusKeyphrase: ['target keyword', 'keyword'],
    canonicalUrl: ['canonical url', 'canonical'],
    ogTitle: ['og:title', 'facebook title'],
    ogDescription: ['og:description', 'facebook description'],
    noindex: ['noindex', 'robots'],
  },
});

export const tsfCsvConnector = createCsvSeoConnector({
  id: 'tsf-csv',
  name: 'The SEO Framework (CSV)',
  detectHints: ['the seo framework', 'tsf', '_tsf', 'genesis_title'],
  columns: {
    url: ['url', 'permalink', 'address'],
    seoTitle: ['title', 'meta title', '_genesis_title'],
    metaDescription: ['description', 'meta description', '_genesis_description'],
    canonicalUrl: ['canonical', 'canonical url'],
    noindex: ['noindex', '_genesis_noindex'],
  },
});

export const slimSeoCsvConnector = createCsvSeoConnector({
  id: 'slim-seo-csv',
  name: 'Slim SEO (CSV)',
  detectHints: ['slim seo', 'slim-seo', 'slimseo'],
  columns: {
    url: ['url', 'permalink'],
    seoTitle: ['title', 'seo title'],
    metaDescription: ['description', 'meta description'],
    canonicalUrl: ['canonical'],
    noindex: ['noindex'],
  },
});

export const screamingFrogConnector = createCsvSeoConnector({
  id: 'screamingfrog-csv',
  name: 'Screaming Frog / Semrush / Ahrefs (CSV)',
  detectHints: ['screaming', 'internal_all', 'semrush', 'ahrefs', 'indexability', 'address,content type'],
  columns: {
    url: ['address', 'url', 'page url'],
    seoTitle: ['title 1', 'title', 'seo title'],
    metaDescription: ['meta description 1', 'meta description', 'description'],
    canonicalUrl: ['canonical link element 1', 'canonical'],
    ogTitle: ['og:title', 'open graph title'],
    ogDescription: ['og:description'],
    ogImage: ['og:image'],
    noindex: ['indexability', 'meta robots 1'],
  },
});
