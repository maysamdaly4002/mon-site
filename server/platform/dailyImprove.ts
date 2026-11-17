/**
 * Cron quotidien — améliore SEO + santé marketplace (devs) + rapport superadmin.
 * Pas de spam backlinks : actions mesurables et sûres pour Google.
 */
import { count, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { mpProducts, mpPublishers, mpSettings } from '../db/schema';
import { getLandingSeo, getSeoBacklinks } from '../superadmin/landingSeo';
import { BACKLINK_CATALOG } from '../superadmin/backlinksCatalog';
import { buildCmsCatalog } from '../marketplace/catalog';

export type DailyImproveAction = {
  id: string;
  ok: boolean;
  detail: string;
};

export type DailyImproveReport = {
  ranAt: string;
  durationMs: number;
  score: number;
  actions: DailyImproveAction[];
  marketplace: {
    published: number;
    pendingReview: number;
    draft: number;
    publishersPending: number;
    publishersActive: number;
    missingScreenshot: number;
    missingDesc: number;
    catalogModules: number;
  };
  seo: {
    ga4: boolean;
    gsc: boolean;
    bing: boolean;
    indexNow: boolean;
    backlinksLive: number;
    backlinksTodo: number;
    backlinksTotal: number;
  };
  health: { url: string; status: number | 'error' }[];
  nextTips: string[];
};

const REPORT_KEY = 'dailyImproveReport';
const META_KEY = 'dailyImproveMeta';

async function saveReport(report: DailyImproveReport) {
  await db
    .insert(mpSettings)
    .values({ key: REPORT_KEY, value: report as never, updatedAt: new Date() })
    .onConflictDoUpdate({ target: mpSettings.key, set: { value: report as never, updatedAt: new Date() } });
  await db
    .insert(mpSettings)
    .values({
      key: META_KEY,
      value: { lastRunAt: report.ranAt, score: report.score } as never,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: mpSettings.key,
      set: { value: { lastRunAt: report.ranAt, score: report.score } as never, updatedAt: new Date() },
    });
}

export async function getDailyImproveReport(): Promise<DailyImproveReport | null> {
  const [row] = await db.select().from(mpSettings).where(eq(mpSettings.key, REPORT_KEY)).limit(1);
  if (!row || typeof row.value !== 'object' || !row.value) return null;
  return row.value as DailyImproveReport;
}

async function headStatus(url: string): Promise<number | 'error'> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'SnapifyDailyImprove/1.0' },
    });
    return res.status;
  } catch {
    return 'error';
  }
}

async function pingIndexNow(urls: string[], key: string): Promise<DailyImproveAction> {
  if (!key.trim()) {
    return { id: 'indexnow', ok: false, detail: 'Clé IndexNow absente — à définir dans SEO → Technique.' };
  }
  if (!urls.length) {
    return { id: 'indexnow', ok: true, detail: 'Aucune URL pour ce host' };
  }
  const host = urls[0].includes('snapify.fr') ? 'snapify.fr' : 'snapify.tn';
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls.slice(0, 40),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    return {
      id: 'indexnow',
      ok: res.ok || res.status === 202,
      detail: `IndexNow ${host} HTTP ${res.status} · ${urls.length} URLs`,
    };
  } catch (e) {
    return { id: 'indexnow', ok: false, detail: e instanceof Error ? e.message : 'IndexNow échoué' };
  }
}

/** Une passe d’amélioration quotidienne. */
export async function runDailyImprove(opts?: { triggeredBy?: string }): Promise<DailyImproveReport> {
  const t0 = Date.now();
  const actions: DailyImproveAction[] = [];
  const seo = await getLandingSeo();
  const tracks = (await getSeoBacklinks()).tracks;

  // —— Marketplace / développeurs
  const [[pubCount]] = await Promise.all([db.select({ n: count() }).from(mpProducts).where(eq(mpProducts.status, 'published'))]);
  const [[pendCount]] = await Promise.all([db.select({ n: count() }).from(mpProducts).where(eq(mpProducts.status, 'pending'))]);
  const [[draftCount]] = await Promise.all([db.select({ n: count() }).from(mpProducts).where(eq(mpProducts.status, 'draft'))]);
  const [[pubPend]] = await Promise.all([
    db.select({ n: count() }).from(mpPublishers).where(eq(mpPublishers.status, 'pending')),
  ]);
  const [[pubActive]] = await Promise.all([
    db.select({ n: count() }).from(mpPublishers).where(eq(mpPublishers.status, 'active')),
  ]);

  const published = await db.select().from(mpProducts).where(eq(mpProducts.status, 'published'));
  const missingScreenshot = published.filter((p) => !p.screenshots?.length).length;
  const missingDesc = published.filter((p) => !(p.shortDesc || '').trim() || (p.shortDesc || '').trim().length < 40).length;

  let catalogModules = 0;
  try {
    const cat = await buildCmsCatalog();
    catalogModules = cat.modules.length;
    // Touche le cache catalogue (timestamp frais pour les sites qui poll)
    await db
      .insert(mpSettings)
      .values({ key: 'marketplaceCatalogCache', value: cat as never, updatedAt: new Date() })
      .onConflictDoUpdate({ target: mpSettings.key, set: { value: cat as never, updatedAt: new Date() } });
    actions.push({
      id: 'marketplace-catalog',
      ok: true,
      detail: `Catalogue régénéré · ${catalogModules} modules/thèmes signés publiés`,
    });
  } catch (e) {
    actions.push({
      id: 'marketplace-catalog',
      ok: false,
      detail: e instanceof Error ? e.message : 'Catalogue marketplace échoué',
    });
  }

  if (pendCount.n > 0) {
    actions.push({
      id: 'marketplace-pending-review',
      ok: false,
      detail: `${pendCount.n} produit(s) en attente de validation — prioritaire pour les devs marketplace`,
    });
  } else {
    actions.push({ id: 'marketplace-pending-review', ok: true, detail: 'Aucune file d’attente produit' });
  }

  if (pubPend.n > 0) {
    actions.push({
      id: 'marketplace-publishers',
      ok: false,
      detail: `${pubPend.n} éditeur(s) en attente d’activation`,
    });
  } else {
    actions.push({ id: 'marketplace-publishers', ok: true, detail: `${pubActive.n} éditeur(s) actifs` });
  }

  if (missingScreenshot > 0 || missingDesc > 0) {
    actions.push({
      id: 'marketplace-quality',
      ok: false,
      detail: `${missingScreenshot} sans screenshot · ${missingDesc} descriptions trop courtes — à corriger côté éditeurs`,
    });
  } else {
    actions.push({ id: 'marketplace-quality', ok: true, detail: 'Fiches produits publiées : screenshots + descriptions OK' });
  }

  // —— Santé URLs publiques
  const urls = [
    'https://snapify.tn/',
    'https://snapify.fr/',
    'https://snapify.fr/creation-site-web-france',
    'https://snapify.tn/creation-site-web-tunisie',
    'https://snapify.fr/seo-france',
    'https://snapify.tn/seo-tunisie',
    'https://marketplace.snapify.tn/',
    'https://marketplace.snapify.fr/',
    'https://community.snapify.tn/',
    'https://developers.snapify.tn/',
    'https://developers.snapify.fr/',
    'https://snapify.tn/sitemap.xml',
    'https://snapify.fr/sitemap.xml',
    'https://snapify.tn/llms.txt',
  ];
  const health: DailyImproveReport['health'] = [];
  for (const url of urls) {
    const status = await headStatus(url);
    health.push({ url, status });
  }
  const bad = health.filter((h) => h.status === 'error' || (typeof h.status === 'number' && h.status >= 400));
  actions.push({
    id: 'health-urls',
    ok: bad.length === 0,
    detail: bad.length === 0 ? `${health.length} URLs OK` : `${bad.length} URL(s) en erreur : ${bad.map((b) => b.url).join(', ')}`,
  });

  // —— IndexNow
  const indexUrls = [
    'https://snapify.tn/',
    'https://snapify.fr/',
    'https://snapify.fr/creation-site-web-france',
    'https://snapify.tn/creation-site-web-tunisie',
    'https://snapify.fr/seo-france',
    'https://snapify.tn/seo-tunisie',
    'https://snapify.fr/alternative-wordpress',
    'https://snapify.fr/alternative-wix',
    'https://snapify.fr/createur-site-web',
    'https://snapify.fr/creation-site-web-paris',
    'https://snapify.tn/creation-site-web-tunis',
    'https://snapify.tn/agence-web-tunisie',
    'https://snapify.tn/boutique-en-ligne-tunisie',
    'https://snapify.tn/guides',
    'https://snapify.fr/guides',
    'https://snapify.tn/guides/tarif-site-web-tunisie-2026',
    'https://snapify.fr/guides/wix-vs-cms-self-hosted',
    'https://snapify.tn/guides/migrer-wordpress-48h',
    'https://snapify.fr/guides/migrer-wordpress-48h',
    'https://snapify.tn/guides/referencement-tunisie-france',
    'https://snapify.fr/guides/referencement-tunisie-france',
    'https://snapify.tn/cas-clients',
    'https://snapify.fr/cas-clients',
    'https://snapify.tn/referencement',
    'https://snapify.fr/referencement',
    'https://marketplace.snapify.tn/',
    'https://marketplace.snapify.fr/',
    'https://developers.snapify.tn/',
    'https://developers.snapify.fr/',
  ];
  // IndexNow : un host = un ping (mélange .tn/.fr → 422)
  const frUrls = indexUrls.filter((u) => u.includes('snapify.fr'));
  const tnUrls = indexUrls.filter((u) => u.includes('snapify.tn'));
  actions.push(await pingIndexNow(frUrls, seo.indexNowKey || ''));
  actions.push(await pingIndexNow(tnUrls, seo.indexNowKey || ''));

  // —— Backlinks progression
  const live = tracks.filter((t) => t.status === 'live').length;
  const todo = tracks.filter((t) => t.status === 'todo' || t.status === 'in_progress').length;
  const p1Todo = BACKLINK_CATALOG.filter((l) => l.priority === 1).filter((l) => {
    const st = tracks.find((t) => t.id === l.id)?.status || 'todo';
    return st === 'todo' || st === 'in_progress';
  }).length;
  actions.push({
    id: 'backlinks',
    ok: live > 0 || todo === 0,
    detail: `${live} live · ${todo} à traiter · ${p1Todo} priorités P1 restantes (dont marketplace/devs)`,
  });

  // —— Score global
  let score = 40;
  if (seo.ga4Id) score += 15;
  if (seo.googleSiteVerification) score += 10;
  if (seo.bingSiteVerification) score += 5;
  if (seo.indexNowKey) score += 10;
  if (bad.length === 0) score += 10;
  if (pendCount.n === 0) score += 5;
  if (missingScreenshot === 0 && missingDesc === 0) score += 5;
  score += Math.min(10, live);
  score = Math.max(0, Math.min(100, score));

  const nextTips: string[] = [];
  if (!seo.googleSiteVerification) nextTips.push('Coller le code meta Search Console (si vérif HTML) dans SEO → Technique.');
  if (!seo.indexNowKey) nextTips.push('Générer une clé IndexNow (Bing) pour accélérer l’indexation quotidienne.');
  if (p1Todo > 0) nextTips.push(`Soumettre ${Math.min(5, p1Todo)} backlinks P1 aujourd’hui (Product Hunt, G2, AlternativeTo…).`);
  if (pendCount.n > 0) nextTips.push(`Valider ${pendCount.n} produit(s) marketplace en attente — les devs attendent.`);
  if (missingScreenshot > 0) nextTips.push('Demander aux éditeurs d’ajouter des screenshots (conversion marketplace).');
  if (live < 10) nextTips.push('Objectif : 10+ backlinks live avant de pousser Google Ads agressivement.');
  nextTips.push('Google Ads : campagne exacte sur « création site web france » → /creation-site-web-france');

  actions.push({
    id: 'trigger',
    ok: true,
    detail: opts?.triggeredBy ? `Déclenché par ${opts.triggeredBy}` : 'Cron automatique quotidien',
  });

  const report: DailyImproveReport = {
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    score,
    actions,
    marketplace: {
      published: Number(pubCount.n),
      pendingReview: Number(pendCount.n),
      draft: Number(draftCount.n),
      publishersPending: Number(pubPend.n),
      publishersActive: Number(pubActive.n),
      missingScreenshot,
      missingDesc,
      catalogModules,
    },
    seo: {
      ga4: !!seo.ga4Id,
      gsc: !!seo.googleSiteVerification,
      bing: !!seo.bingSiteVerification,
      indexNow: !!seo.indexNowKey,
      backlinksLive: live,
      backlinksTodo: todo,
      backlinksTotal: BACKLINK_CATALOG.length,
    },
    health,
    nextTips,
  };

  await saveReport(report);
  console.log(
    `[daily-improve] score=${score} marketplace pending=${pendCount.n} catalog=${catalogModules} live-backlinks=${live} (${report.durationMs}ms)`
  );
  return report;
}

/**
 * Planifie une exécution ~03:00 heure serveur + garde-fou si dernier run > 20 h.
 */
export function startDailyImproveScheduler() {
  const DAY = 24 * 3600 * 1000;
  let running = false;

  const tick = async (reason: string) => {
    if (running) return;
    running = true;
    try {
      await runDailyImprove({ triggeredBy: reason });
    } catch (e) {
      console.error('[daily-improve] échec', e);
    } finally {
      running = false;
    }
  };

  const msUntil3am = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(3, 5, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  };

  // Premier run : si jamais exécuté ou > 20 h
  void (async () => {
    try {
      const [row] = await db.select().from(mpSettings).where(eq(mpSettings.key, META_KEY)).limit(1);
      const last = (row?.value as { lastRunAt?: string } | null)?.lastRunAt;
      const age = last ? Date.now() - new Date(last).getTime() : Infinity;
      if (age > 20 * 3600 * 1000) {
        // léger délai pour laisser le serveur finir de booter
        setTimeout(() => void tick('boot-catchup'), 45_000).unref();
      }
    } catch (e) {
      console.warn('[daily-improve] meta', e);
    }
  })();

  setTimeout(() => {
    void tick('scheduled-3am');
    setInterval(() => void tick('scheduled-3am'), DAY).unref();
  }, msUntil3am()).unref();

  console.log(`[daily-improve] planifié — prochain passage dans ~${Math.round(msUntil3am() / 3600000)} h (03:05)`);
}
