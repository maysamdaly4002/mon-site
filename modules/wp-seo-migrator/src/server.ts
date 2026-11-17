/**
 * WP SEO Migrator — serveur
 * Jobs via setInterval (pas d’API jobs dans le SDK — voir ARCHITECTURE.md).
 */
import { defineServerModule, type ServerContext, type Collection } from '@snapify/sdk';
import { mergeRecords, runConnectors } from './connectors';
import { applyAutoFix, buildIssues, buildPreview, computeStats, toSnapifySeo } from './pipeline/analyze';
import { remoteAutoAnalyze, type RemoteCreds } from './pipeline/remoteAuto';
import type { MigrationJob, SeoRecord, RedirectRecord, Settings, UploadedFile } from './types';

/** Job léger : les enregistrements SEO sont en chunks (limite 256 Ko / doc). */
type JobDoc = Omit<MigrationJob, 'id'> & {
  recordCount: number;
  redirectCount: number;
};

type ChunkDoc = {
  jobId: string;
  kind: 'records' | 'redirects';
  seq: number;
  items: SeoRecord[] | RedirectRecord[];
};

function id() {
  return `mig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicJob(job: { id: string } & JobDoc): MigrationJob {
  return job;
}

function slimRecord(r: SeoRecord): SeoRecord {
  return {
    ...r,
    schemaJsonLd: r.schemaJsonLd ? r.schemaJsonLd.slice(0, 400) : undefined,
    imageAlts: r.imageAlts?.slice(0, 3),
    hreflang: r.hreflang?.slice(0, 8),
    metaDescription: r.metaDescription?.slice(0, 320),
    seoTitle: r.seoTitle?.slice(0, 120),
    ogDescription: r.ogDescription?.slice(0, 320),
  };
}

async function clearChunks(chunks: Collection<ChunkDoc>, jobId: string) {
  const { items } = await chunks.find({ where: { jobId }, limit: 500 });
  for (const c of items) await chunks.delete(c.id);
}

async function savePayload(chunks: Collection<ChunkDoc>, jobId: string, records: SeoRecord[], redirects: RedirectRecord[]) {
  await clearChunks(chunks, jobId);
  const R = 25;
  const slim = records.map(slimRecord);
  for (let i = 0; i < slim.length; i += R) {
    await chunks.insert({ jobId, kind: 'records', seq: Math.floor(i / R), items: slim.slice(i, i + R) });
  }
  for (let i = 0; i < redirects.length; i += 80) {
    await chunks.insert({ jobId, kind: 'redirects', seq: Math.floor(i / 80), items: redirects.slice(i, i + 80) });
  }
}

async function loadPayload(chunks: Collection<ChunkDoc>, jobId: string): Promise<{ records: SeoRecord[]; redirects: RedirectRecord[] }> {
  const { items } = await chunks.find({ where: { jobId }, limit: 500, orderBy: [{ field: 'seq', dir: 'asc' }] });
  const records: SeoRecord[] = [];
  const redirects: RedirectRecord[] = [];
  for (const c of items.sort((a, b) => a.seq - b.seq || (a.kind < b.kind ? -1 : 1))) {
    if (c.kind === 'records') records.push(...(c.items as SeoRecord[]));
    else redirects.push(...(c.items as RedirectRecord[]));
  }
  return { records, redirects };
}

export default defineServerModule<Settings>({
  async activate(ctx: ServerContext<Settings>) {
    const jobs = ctx.db.collection<JobDoc>('migrations');
    const chunks = ctx.db.collection<ChunkDoc>('mig_chunks');
    const watch = ctx.db.collection<{ path: string; hits: number; lastAt: string }>('watch_404');

    const tick = async () => {
      await ctx.lock('wp-seo-worker', async () => {
        const { items } = await jobs.find({ limit: 20 });
        const running = items.filter((j) => j.status === 'running');
        for (const job of running) {
          if (job.progress.done >= job.progress.total && job.progress.total > 0 && job.status === 'running') {
            const report = job.report || {
              migrated: job.recordCount,
              redirectsAdded: job.redirectCount,
              missing: 0,
              errors: [],
              dnsChecklist: [
                'Gardez l’ancien domaine pointé vers Snapify (ou redirigez-le).',
                'Vérifiez HTTPS (certificat) sur le nouveau site.',
                'Soumettez le sitemap Snapify dans Google Search Console.',
                'Surveillez les 404 pendant 30 jours dans cet assistant.',
              ],
            };
            await jobs.update(job.id, {
              status: 'done',
              updatedAt: new Date().toISOString(),
              progress: { ...job.progress, message: 'Migration terminée' },
              report,
            });
            const to = ctx.settings().notifyEmail || ctx.site().email;
            if (to) {
              const { html, text } = ctx.mail.render({
                title: 'Migration SEO terminée',
                intro: `La migration SEO de ${job.siteUrl || 'votre site'} est terminée.`,
                lines: [
                  `${job.recordCount} contenus analysés`,
                  `${job.redirectCount} redirections préparées`,
                  `Couverture SEO estimée : ${job.stats.coveragePct} %`,
                ],
                button: { label: 'Ouvrir Snapify', url: `${ctx.site().publicUrl}/administrator/` },
              });
              await ctx.mail.send({ to, subject: 'Snapify — migration SEO terminée', html, text });
            }
          }
        }
      });
    };

    const timer = setInterval(() => {
      void tick().catch((e) => ctx.log.error('worker', e));
    }, 3000);

    ctx.admin.status(async () => {
      const { items } = await jobs.find({ limit: 50 });
      const done = items.filter((j) => j.status === 'done').length;
      const running = items.filter((j) => j.status === 'running').length;
      return {
        stats: [
          { label: 'Migrations', value: items.length },
          { label: 'En cours', value: running },
          { label: 'Terminées', value: done },
        ],
      };
    });

    /** Plugin PHP Exporter (téléchargement). */
    ctx.admin.get('/exporter-plugin', async () => {
      const php = `<?php
/**
 * Plugin Name: Snapify SEO Exporter
 * Description: Exporte titres SEO, meta, redirections (Yoast, Rank Math, etc.) pour Snapify WP SEO Migrator.
 * Version: 1.0.0
 * Author: Hamdi Ayari
 */
if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
  register_rest_route('snapify/v1', '/seo-export', [
    'methods' => 'GET',
    'permission_callback' => function () { return current_user_can('manage_options'); },
    'callback' => 'snapify_seo_export',
  ]);
});

function snapify_seo_export() {
  $records = [];
  $q = new WP_Query(['post_type' => ['post','page','product'], 'post_status' => 'any', 'posts_per_page' => 5000, 'no_found_rows' => true]);
  foreach ($q->posts as $p) {
    $url = get_permalink($p);
    $yoast_title = get_post_meta($p->ID, '_yoast_wpseo_title', true);
    $yoast_desc = get_post_meta($p->ID, '_yoast_wpseo_metadesc', true);
    $rm_title = get_post_meta($p->ID, 'rank_math_title', true);
    $rm_desc = get_post_meta($p->ID, 'rank_math_description', true);
    $records[] = [
      'id' => (string)$p->ID,
      'kind' => $p->post_type === 'page' ? 'page' : ($p->post_type === 'product' ? 'product' : 'post'),
      'url' => $url,
      'path' => wp_parse_url($url, PHP_URL_PATH) ?: '/',
      'slug' => $p->post_name,
      'status' => $p->post_status === 'publish' ? 'publish' : 'draft',
      'title' => get_the_title($p),
      'seoTitle' => $yoast_title ?: $rm_title ?: get_the_title($p),
      'metaDescription' => $yoast_desc ?: $rm_desc ?: '',
      'focusKeyphrase' => get_post_meta($p->ID, '_yoast_wpseo_focuskw', true) ?: get_post_meta($p->ID, 'rank_math_focus_keyword', true),
      'canonicalUrl' => get_post_meta($p->ID, '_yoast_wpseo_canonical', true) ?: get_post_meta($p->ID, 'rank_math_canonical_url', true),
      'noindex' => get_post_meta($p->ID, '_yoast_wpseo_meta-robots-noindex', true) === '1',
      'sources' => ['seoTitle' => $yoast_title ? 'yoast' : ($rm_title ? 'rankmath' : 'wp')],
    ];
  }
  $redirects = [];
  if (class_exists('Redirection_Api')) { /* optional */ }
  return [
    'format' => 'snapify-wp-seo/1',
    'site' => ['url' => home_url('/')],
    'plugins' => [
      ['id' => 'wordpress-seo', 'name' => 'Yoast SEO', 'active' => is_plugin_active('wordpress-seo/wp-seo.php')],
      ['id' => 'seo-by-rank-math', 'name' => 'Rank Math', 'active' => is_plugin_active('seo-by-rank-math/rank-math.php')],
    ],
    'records' => $records,
    'redirects' => $redirects,
  ];
}
`;
      return { filename: 'snapify-seo-exporter.php', content: php };
    });

    ctx.admin.post('/analyze', async (req) => {
      const body = (req.body || {}) as {
        siteUrl?: string;
        files?: UploadedFile[];
        wpUser?: string;
        wpAppPassword?: string;
        ftp?: RemoteCreds['ftp'];
      };
      const siteUrl = String(body.siteUrl || '').trim();
      const files = Array.isArray(body.files) ? body.files.slice(0, 10) : [];
      if (!siteUrl && !files.length) {
        throw ctx.error(422, 'Indiquez l’adresse de votre site WordPress (ex. https://www.monsite.tn).');
      }

      for (const f of files) {
        if (!f.name || typeof f.content !== 'string') throw ctx.error(422, 'Fichier invalide.');
        if (f.content.length > 12_000_000) throw ctx.error(413, `Fichier trop volumineux : ${f.name}`);
      }

      const creds: RemoteCreds = {
        wpUser: body.wpUser?.trim() || undefined,
        wpAppPassword: body.wpAppPassword?.trim() || undefined,
        ftp: body.ftp?.host && body.ftp?.user ? { ...body.ftp, password: String(body.ftp.password || '') } : undefined,
      };

      const jobId = id();
      const now = new Date().toISOString();
      const emptyStats = { pages: 0, posts: 0, products: 0, terms: 0, redirects: 0, withTitle: 0, withDesc: 0, withCanonical: 0, withOg: 0, coveragePct: 0 };
      const draft: JobDoc = {
        status: 'analyzing',
        siteUrl: siteUrl || 'export-local',
        createdAt: now,
        updatedAt: now,
        connectors: [],
        stats: emptyStats,
        issues: [],
        preview: [],
        progress: { total: 100, done: 0, errors: 0, message: 'Démarrage de l’analyse…' },
        apply: { updateSeo: true, addRedirects: true, createMissingDrafts: false },
        recordCount: 0,
        redirectCount: 0,
      };
      const saved = await jobs.insert(draft, { id: jobId });

      // Travail en arrière-plan (évite le timeout 60 s des routes admin).
      void (async () => {
        try {
          let detects = [] as ReturnType<typeof runConnectors>['detects'];
          let records: SeoRecord[] = [];
          let redirects: RedirectRecord[] = [];
          let warnings: string[] = [];
          const allFiles = [...files];

          const bump = async (message: string, pct = 0) => {
            await jobs.update(jobId, {
              updatedAt: new Date().toISOString(),
              progress: { total: 100, done: Math.min(99, Math.max(0, pct)), errors: 0, message },
            });
          };

          if (siteUrl) {
            const auto = await remoteAutoAnalyze({
              siteUrl,
              fetch: (url, init) => ctx.fetch(url, init),
              ftp: ctx.ftp,
              creds,
              maxCrawl: 40,
              onProgress: bump,
            });
            detects = auto.detects;
            records = auto.records;
            redirects = auto.redirects;
            warnings = auto.warnings;
            allFiles.push(...auto.filesFromRemote);
          }

          if (allFiles.length) {
            await bump('Lecture des fichiers récupérés…', 92);
            const fromFiles = runConnectors(allFiles, siteUrl);
            const merged = mergeRecords([
              { records, redirects, warnings: [] },
              { records: fromFiles.records, redirects: fromFiles.redirects, warnings: fromFiles.warnings },
            ]);
            records = merged.records;
            redirects = merged.redirects;
            warnings = [...warnings, ...merged.warnings];
            detects = [...detects, ...fromFiles.detects.filter((d) => d.found)];
          }

          if (!records.length && !redirects.length) {
            await jobs.update(jobId, {
              status: 'failed',
              updatedAt: new Date().toISOString(),
              progress: {
                total: 100,
                done: 100,
                errors: 1,
                message:
                  'Aucune donnée SEO trouvée. Vérifiez l’URL, ou ajoutez un mot de passe d’application / FTP dans Options avancées.',
              },
            });
            return;
          }

          const stats = computeStats(records, redirects);
          const issues = buildIssues(records, redirects);
          for (const w of warnings) issues.push({ id: `warn-${w.slice(0, 24)}`, severity: 'info', message: w });

          await bump('Enregistrement des résultats…', 97);
          await savePayload(chunks, jobId, records, redirects);

          await jobs.update(jobId, {
            status: 'ready',
            updatedAt: new Date().toISOString(),
            connectors: detects,
            stats,
            issues,
            preview: buildPreview(records),
            progress: { total: records.length + redirects.length, done: 0, errors: 0, message: 'Prêt à migrer' },
            recordCount: records.length,
            redirectCount: redirects.length,
          });
        } catch (e) {
          ctx.log.error('analyze', e);
          await jobs.update(jobId, {
            status: 'failed',
            updatedAt: new Date().toISOString(),
            progress: {
              total: 100,
              done: 100,
              errors: 1,
              message: e instanceof Error ? e.message : 'Analyse impossible',
            },
          });
        }
      })();

      return { job: publicJob(saved), polling: true };
    });

    ctx.admin.get('/jobs/:id', async (req) => {
      const job = await jobs.get(req.params.id);
      if (!job) throw ctx.error(404, 'Migration introuvable');
      return { job: publicJob(job), recordsCount: job.recordCount, redirectsCount: job.redirectCount };
    });

    ctx.admin.get('/jobs/:id/apply-plan', async (req) => {
      const job = await jobs.get(req.params.id);
      if (!job) throw ctx.error(404, 'Migration introuvable');
      if (job.status === 'cancelled') throw ctx.error(409, 'Migration annulée');
      const { records, redirects } = await loadPayload(chunks, job.id);
      return {
        jobId: job.id,
        apply: job.apply,
        seoUpdates: records.map((r) => ({
          path: r.path,
          seo: toSnapifySeo(r),
          title: r.title || r.seoTitle || r.slug,
        })),
        redirects: redirects.map((r) => ({ from: r.from, to: r.to, permanent: r.permanent })),
        preserve: records.map((r) => ({ from: r.path, to: r.path, permanent: true })),
      };
    });

    ctx.admin.post('/jobs/:id/autofix', async (req) => {
      const job = await jobs.get(req.params.id);
      if (!job) throw ctx.error(404, 'Migration introuvable');
      const actionId = String((req.body as { actionId?: string })?.actionId || '');
      const payload = await loadPayload(chunks, job.id);
      const records = applyAutoFix(payload.records, actionId);
      const stats = computeStats(records, payload.redirects);
      const issues = buildIssues(records, payload.redirects);
      const preview = buildPreview(records);
      await savePayload(chunks, job.id, records, payload.redirects);
      const updated = await jobs.update(job.id, {
        stats,
        issues,
        preview,
        recordCount: records.length,
        redirectCount: payload.redirects.length,
        updatedAt: new Date().toISOString(),
      });
      return { job: publicJob(updated!) };
    });

    ctx.admin.post('/jobs/:id/start', async (req) => {
      const job = await jobs.get(req.params.id);
      if (!job) throw ctx.error(404, 'Migration introuvable');
      if (job.status === 'cancelled') throw ctx.error(409, 'Migration annulée');
      const apply = (req.body as { apply?: JobDoc['apply'] })?.apply;
      const nextApply = apply ? { ...job.apply, ...apply } : job.apply;
      const progress = {
        total: Math.max(1, (nextApply.updateSeo ? job.recordCount : 0) + (nextApply.addRedirects ? job.redirectCount : 0)),
        done: 0,
        errors: 0,
        message: 'Application en cours…',
      };
      const updated = await jobs.update(job.id, {
        apply: nextApply,
        status: 'running',
        progress,
        updatedAt: new Date().toISOString(),
      });
      return { job: publicJob(updated!) };
    });

    ctx.admin.post('/jobs/:id/progress', async (req) => {
      const job = await jobs.get(req.params.id);
      if (!job) throw ctx.error(404, 'Migration introuvable');
      const body = (req.body || {}) as { done?: number; errors?: number; message?: string; report?: JobDoc['report'] };
      const progress = { ...job.progress };
      if (typeof body.done === 'number') progress.done = body.done;
      if (typeof body.errors === 'number') progress.errors = body.errors;
      if (body.message) progress.message = body.message;
      const patch: Partial<JobDoc> = { progress, updatedAt: new Date().toISOString() };
      if (body.report) patch.report = body.report;
      if (progress.done >= progress.total) {
        patch.status = 'done';
        progress.message = 'Terminé';
        patch.progress = progress;
      }
      const updated = await jobs.update(job.id, patch);
      return { job: publicJob(updated!) };
    });

    ctx.admin.post('/jobs/:id/cancel', async (req) => {
      const job = await jobs.get(req.params.id);
      if (!job) throw ctx.error(404, 'Migration introuvable');
      await jobs.update(job.id, {
        status: 'cancelled',
        progress: { ...job.progress, message: 'Annulée' },
        updatedAt: new Date().toISOString(),
      });
      return { ok: true };
    });

    ctx.admin.get('/jobs', async () => {
      const { items } = await jobs.find({ limit: 50 });
      return { items: items.map((j) => publicJob(j)) };
    });

    // Pas de « . » dans les routes modules (ROUTE_PATTERN serveur).
    ctx.admin.get('/jobs/:id/report', async (req) => {
      const job = await jobs.get(req.params.id);
      if (!job) throw ctx.error(404, 'Migration introuvable');
      const { records, redirects } = await loadPayload(chunks, job.id);
      const lines = ['path,kind,seoTitle,metaDescription,canonical,noindex,source_title'];
      for (const r of records) {
        lines.push(
          [r.path, r.kind, csv(r.seoTitle), csv(r.metaDescription), csv(r.canonicalUrl), r.noindex ? '1' : '0', r.sources.seoTitle || ''].join(',')
        );
      }
      lines.push('');
      lines.push('from,to,permanent,source');
      for (const r of redirects) lines.push([r.from, r.to, r.permanent ? '301' : '302', r.source].join(','));
      return { filename: `snapify-seo-migration-${job.id}.csv`, csv: lines.join('\n') };
    });

    ctx.admin.post('/watch/hit', async (req) => {
      const path = String((req.body as { path?: string })?.path || '');
      if (!path) throw ctx.error(422, 'Chemin manquant');
      const existing = (await watch.find({ limit: 500 })).items.find((x) => x.path === path);
      if (existing) {
        await watch.update(existing.id, { hits: existing.hits + 1, lastAt: new Date().toISOString() });
      } else {
        await watch.insert({ path, hits: 1, lastAt: new Date().toISOString() });
      }
      return { ok: true };
    });

    return () => clearInterval(timer);
  },
});

function csv(v?: string) {
  const s = String(v || '').replace(/"/g, '""');
  return `"${s}"`;
}

function readableSummary(
  stats: ReturnType<typeof computeStats>,
  detects: { name: string; found: boolean }[]
): string {
  const plugins = detects.filter((d) => d.found).map((d) => d.name);
  const parts = [
    `${stats.pages + stats.posts + stats.products} contenus`,
    stats.posts ? `${stats.posts} articles` : '',
    stats.pages ? `${stats.pages} pages` : '',
    stats.products ? `${stats.products} produits` : '',
    `${stats.redirects} redirections`,
    plugins.length ? plugins.join(', ') + ' trouvé(s)' : 'plugins SEO non détectés dans le fichier',
  ].filter(Boolean);
  return parts.join(' · ');
}
