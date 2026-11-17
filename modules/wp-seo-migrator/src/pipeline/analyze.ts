import type { CoverageIssue, MigrationStats, SeoRecord, RedirectRecord } from '../types';

export function computeStats(records: SeoRecord[], redirects: RedirectRecord[]): MigrationStats {
  const pages = records.filter((r) => r.kind === 'page').length;
  const posts = records.filter((r) => r.kind === 'post').length;
  const products = records.filter((r) => r.kind === 'product').length;
  const terms = records.filter((r) => r.kind === 'term').length;
  const withTitle = records.filter((r) => !!r.seoTitle?.trim()).length;
  const withDesc = records.filter((r) => !!r.metaDescription?.trim()).length;
  const withCanonical = records.filter((r) => !!r.canonicalUrl?.trim()).length;
  const withOg = records.filter((r) => !!r.ogTitle?.trim() || !!r.ogImage?.trim()).length;
  const n = Math.max(records.length, 1);
  // Pondération simple : title 35, desc 35, canonical 15, og 15
  const score =
    ((withTitle / n) * 35 + (withDesc / n) * 35 + (withCanonical / n) * 15 + (withOg / n) * 15) | 0;
  return {
    pages: pages || records.filter((r) => r.kind === 'other').length,
    posts,
    products,
    terms,
    redirects: redirects.length,
    withTitle,
    withDesc,
    withCanonical,
    withOg,
    coveragePct: Math.min(100, Math.max(0, score)),
  };
}

export function buildIssues(records: SeoRecord[], redirects: RedirectRecord[]): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const missingTitle = records.filter((r) => !r.seoTitle?.trim()).length;
  const missingDesc = records.filter((r) => !r.metaDescription?.trim()).length;
  const longTitle = records.filter((r) => (r.seoTitle || '').length > 60).length;
  const shortDesc = records.filter((r) => {
    const l = (r.metaDescription || '').length;
    return l > 0 && l < 70;
  }).length;
  const dupTitles = new Map<string, number>();
  for (const r of records) {
    const t = (r.seoTitle || '').trim().toLowerCase();
    if (!t) continue;
    dupTitles.set(t, (dupTitles.get(t) || 0) + 1);
  }
  const dups = [...dupTitles.values()].filter((n) => n > 1).length;

  if (missingTitle)
    issues.push({
      id: 'missing-title',
      severity: 'warn',
      message: `${missingTitle} page(s) sans titre SEO — on peut reprendre le titre de la page.`,
      action: { id: 'fix-titles', label: 'Corriger automatiquement' },
      count: missingTitle,
    });
  if (missingDesc)
    issues.push({
      id: 'missing-desc',
      severity: 'warn',
      message: `${missingDesc} page(s) sans meta description — trafic possible mais extrait Google moins contrôlé.`,
      count: missingDesc,
    });
  if (longTitle)
    issues.push({
      id: 'long-title',
      severity: 'info',
      message: `${longTitle} titre(s) un peu longs (> 60 caractères) — Google peut les tronquer.`,
      action: { id: 'trim-titles', label: 'Raccourcir automatiquement' },
      count: longTitle,
    });
  if (shortDesc)
    issues.push({
      id: 'short-desc',
      severity: 'info',
      message: `${shortDesc} description(s) trop courtes — mieux vaut 120–160 caractères.`,
      count: shortDesc,
    });
  if (dups)
    issues.push({
      id: 'dup-titles',
      severity: 'warn',
      message: `${dups} titre(s) SEO en double — à différencier pour éviter la cannibalisation.`,
      count: dups,
    });
  if (!redirects.length)
    issues.push({
      id: 'no-redirects',
      severity: 'info',
      message: 'Aucune redirection trouvée dans l’export — on créera des 301 si les adresses changent.',
    });
  return issues;
}

export function buildPreview(records: SeoRecord[]): { before: Partial<SeoRecord>; after: Partial<SeoRecord> }[] {
  return records.slice(0, 5).map((r) => {
    const title = (r.seoTitle || r.title || '').trim();
    const desc = (r.metaDescription || '').trim();
    return {
      before: {
        path: r.path,
        seoTitle: title || '',
        metaDescription: desc,
        canonicalUrl: r.canonicalUrl || r.path,
      },
      after: {
        path: r.path,
        seoTitle: title.slice(0, 60),
        metaDescription: desc.slice(0, 160),
        canonicalUrl: r.canonicalUrl || r.path,
        noindex: !!r.noindex,
      },
    };
  });
}

/** Auto-fixes demandés par l’UI */
export function applyAutoFix(records: SeoRecord[], actionId: string): SeoRecord[] {
  if (actionId === 'fill-titles') {
    return records.map((r) =>
      r.seoTitle?.trim()
        ? r
        : { ...r, seoTitle: (r.title || r.slug || 'Page').slice(0, 60), sources: { ...r.sources, seoTitle: 'autofix' } }
    );
  }
  if (actionId === 'trim-titles') {
    return records.map((r) =>
      (r.seoTitle || '').length > 60
        ? { ...r, seoTitle: r.seoTitle!.slice(0, 57).trimEnd() + '…', sources: { ...r.sources, seoTitle: r.sources.seoTitle || 'autofix' } }
        : r
    );
  }
  return records;
}

export function toSnapifySeo(r: SeoRecord) {
  const schema =
    r.schemaType === 'Article' || r.kind === 'post'
      ? 'Article'
      : r.schemaType === 'Organization'
        ? 'Organization'
        : r.schemaType === 'LocalBusiness'
          ? 'LocalBusiness'
          : 'WebPage';
  return {
    focusKeyphrase: (r.focusKeyphrase || '').slice(0, 100),
    seoTitle: (r.seoTitle || r.title || '').slice(0, 70),
    metaDescription: (r.metaDescription || '').slice(0, 180),
    slug: r.slug || 'page',
    canonicalUrl: r.canonicalUrl || '',
    noindex: !!r.noindex,
    nofollow: !!r.nofollow,
    ogTitle: r.ogTitle || r.seoTitle || '',
    ogDescription: r.ogDescription || r.metaDescription || '',
    ogImage: r.ogImage || '',
    twitterCard: r.twitterCard || 'summary_large_image',
    schemaType: schema as 'WebPage' | 'Article' | 'Organization' | 'LocalBusiness',
    breadcrumbsTitle: r.breadcrumbsTitle || r.title || '',
  };
}
