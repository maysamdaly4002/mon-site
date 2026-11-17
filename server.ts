/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createAdminCmsRouter } from './server/routes/adminCms';
import { createPublicCmsRouter, injectMaintenance } from './server/routes/publicCms';
import { createGoogleOAuthRouter } from './server/routes/googleOAuth';
import { createSeoPublicRouter, injectSeo, redirectMiddleware } from './server/routes/seoPublic';
import { injectTheme } from './server/modules/themeHtml';
import { loadSnapshot } from './server/cms/store';
import { runRetention } from './server/security/retention';
import { adminIpGuard } from './server/middleware/adminAuth';
import { auditMiddleware } from './server/security/audit';
import { rateLimit } from './server/security/rateLimit';
import { clientIp } from './server/security/ip';
import { createAdminAccountRouter } from './server/routes/adminAccount';
import { createAdminUsersRouter } from './server/routes/adminUsers';
import { createAdminSystemRouter } from './server/routes/adminSystem';
import { closeDb, runMigrations } from './server/db/client';
import { apiErrorHandler } from './server/http';
import { initModules } from './server/modules/manager';
import { createModulesAdminRouter, createModulesPublicRouter } from './server/routes/modules';
import { isLegacyClientHost, legacyClientRedirectUrl, resolveAppHost } from './server/platform/host';
import { resolveGeoFromIp } from './server/geoip';
import { isCmsAppDistro } from './server/distro';
import { Router } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requestHostHeader(req: { headers: Record<string, unknown> }): string {
  const xf = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  return (xf || String(req.headers.host || 'snapify.tn')).split(':')[0].toLowerCase();
}

/** Googlebot & crawlers : pays = marché du host (.fr → FR), pas la géoloc IP du datacenter. */
function isSearchCrawler(ua: string): boolean {
  return /googlebot|bingbot|yandex|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|linkedinbot|applebot|semrush|ahrefs|dotbot|mj12bot/i.test(
    ua || ''
  );
}

function hostMarketCountry(host: string): 'FR' | 'TN' {
  return /(^|\.)snapify\.fr$/i.test(host) || host.endsWith('.fr') ? 'FR' : 'TN';
}

function countryForRequest(req: { headers: Record<string, unknown> }, host: string, geoCountry: string): string {
  if (isSearchCrawler(String(req.headers['user-agent'] || ''))) {
    return hostMarketCountry(host);
  }
  return geoCountry || hostMarketCountry(host);
}

function sendXml(res: express.Response, body: string) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.removeHeader('X-Robots-Tag');
  res.status(200).send(body);
}

function injectCountryScript(html: string, country: string): string {
  const safe = country.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  if (html.includes('__SNAPIFY_COUNTRY__')) return html;
  const script = `<script>window.__SNAPIFY_COUNTRY__=${JSON.stringify(safe)};</script>`;
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : script + html;
}

/** Hors Tunisie : titre et prix en euros dès le HTML, avant l’hydratation + SEO serveur. */
async function withLandingMarket(html: string, country: string, host: string, pathName = '/'): Promise<string> {
  if (isCmsAppDistro()) return injectCountryScript(html, country);
  let out = injectCountryScript(html, country);
  try {
    const landingSeo = await import('./server/superadmin/landingSeo');
    const market = landingSeo.marketFromHost(host);
    const seo = await landingSeo.getLandingSeo();
    const pack = landingSeo.buildMarketSeoPack(seo, market, pathName);
    const tags = landingSeo.renderLandingHeadTags(pack, seo);
    out = out.replace(/<title>[^<]*<\/title>/i, '');
    out = out.replace(/<meta\s+name="description"[^>]*>/gi, '');
    out = out.replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '');
    out = out.replace(/<link\s+rel="canonical"[^>]*>/gi, '');
    out = out.replace('</head>', `    ${tags}\n  </head>`);
    const crawler = landingSeo.crawlerSeoHtml(pathName.replace(/\/$/, '') || '/', market);
    if (crawler) {
      out = out.replace(/<article id="snapify-seo-crawler"[\s\S]*?<\/article>/i, '');
      if (out.includes('<div id="root"></div>')) {
        out = out.replace('<div id="root"></div>', `${crawler}\n    <div id="root"></div>`);
      } else if (out.includes('<div id="root">')) {
        out = out.replace(/<div id="root">/, `${crawler}\n    <div id="root">`);
      }
    }
  } catch (e) {
    console.warn('[landing-seo]', e);
  }
  const { marketFromHost } = await import('./server/superadmin/landingSeo');
  if (marketFromHost(host) === 'tn') return out;
  return out
    .replaceAll('CMS tunisien pour sites & e-commerce', 'CMS pour sites & e-commerce')
    .replaceAll('CMS moderne sans PHP | IA, migration, e-commerce', 'CMS moderne | IA, migration, e-commerce')
    .replaceAll('CMS tunisien', 'CMS')
    .replaceAll('699 DT/an', '99 €/an')
    .replaceAll('699 DT', '99 €');
}

function emptyRouter() {
  return Router();
}

/** Indique au front (demoBase.ts) qu’on est en install CMS client. */
function injectDistroScript(html: string, cmsOnly: boolean): string {
  if (!cmsOnly) return html;
  if (html.includes('__SNAPIFY_DISTRIBUTION__')) return html;
  const script = `<script>window.__SNAPIFY_DISTRIBUTION__="cms";</script>`;
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : script + html;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const cmsOnly = isCmsAppDistro();
  if (cmsOnly) console.log('[distro] mode CMS (create-snapify-app) — sans marketplace / community / landing');

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Ancien préfixe /demo (plateforme) → racine en install client
  if (cmsOnly) {
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path === '/demo' || req.path === '/demo/') {
        return res.redirect(301, '/');
      }
      if (req.path.startsWith('/demo/')) {
        return res.redirect(301, req.path.slice('/demo'.length) || '/');
      }
      next();
    });
  }

  await runMigrations();
  if (!cmsOnly) {
    const { seedPlatform } = await import('./server/platform/seed');
    await seedPlatform();
  }
  await loadSnapshot();
  await initModules();

  // « //hamdisup90 » ou « /administrator//pages » : redirige vers le chemin propre au lieu d’afficher la landing.
  // Les « \ » sont normalisés aussi : « /\evil.com » serait suivi par les navigateurs comme une autre origine.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const [pathname, ...query] = req.originalUrl.split('?');
    if (!/\/\/|\\/.test(pathname)) return next();
    const clean = pathname.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    res.redirect(301, clean + (query.length ? `?${query.join('?')}` : ''));
  });

  // Plus de sous-domaine client.* : redirection vers /espace-client sur snapify.tn / snapify.fr
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const host = requestHostHeader(req);
    if (!isLegacyClientHost(host)) return next();
    const dest = legacyClientRedirectUrl(host, req.originalUrl || '/');
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(301, dest);
  });

  app.use(async (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/administrator') || req.path.startsWith('/api/admin')) {
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    try {
      if (req.secure && (await loadSnapshot()).system.security.hsts) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  // Base64 : +37 % par rapport à la taille du fichier autorisée dans les paramètres « Médias ».
  app.use('/api/admin/media/upload', async (req, res, next) => {
    try {
      const { maxSizeMb } = (await loadSnapshot()).system.uploads;
      express.json({ limit: `${Math.ceil(maxSizeMb * 1.37) + 1}mb` })(req, res, next);
    } catch (e) {
      next(e);
    }
  });
  app.use('/api/admin/modules/upload', express.json({ limit: '30mb' }));
  app.use('/api/marketplace/developer', express.json({ limit: '30mb' }));
  // Webhook Flouci : conserver le corps brut pour la vérification HMAC
  app.use(
    '/api/platform/flouci/webhook',
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.json({ limit: '1mb' }));
  if (!cmsOnly) {
    const { geoRegionRedirect } = await import('./server/platform/region');
    app.use(geoRegionRedirect);
  }
  app.use((req, res, next) => {
    if (resolveAppHost(req) === 'cms') return redirectMiddleware(req, res, next);
    next();
  });

  app.use('/uploads', express.static(path.resolve(__dirname, 'public/uploads'), { maxAge: '30d', immutable: true }));
  app.use(express.static(path.resolve(__dirname, 'public'), { index: false }));

  const publicQuota = rateLimit(
    'public',
    async () => ({ max: (await loadSnapshot()).system.limits.publicApiPerMinute, windowMs: 60_000 }),
    clientIp
  );
  app.use('/api/public', publicQuota);
  app.use('/api/modules', publicQuota);
  app.use('/api/admin', adminIpGuard, auditMiddleware);

  let marketplaceRouter = emptyRouter();
  if (!cmsOnly) {
    const platform = await import('./server/platform/routes');
    const { createCommunityRouter } = await import('./server/community/routes');
    const { createMarketplaceRouter } = await import('./server/marketplace/routes');
    const { createClientPortalRouter } = await import('./server/client/routes');
    const { createSdkDownloadsRouter } = await import('./server/developers/sdk');
    const { createSuperadminRouter, landingRobotsTxt, landingSitemapIndexXml, landingSitemapXml } = await import(
      './server/superadmin/routes'
    );
    const { getLandingSeo, marketFromHost } = await import('./server/superadmin/landingSeo');
    const sendXml = (res: express.Response, xml: string) =>
      res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);

    app.use('/api/community', publicQuota);
    app.use('/api/marketplace', publicQuota);
    app.use('/api/platform', publicQuota);
    app.use('/api/superadmin', publicQuota);
    app.use('/api/platform/auth', platform.createPlatformAuthRouter());
    app.use('/api/platform/flouci', platform.createFlouciWebhookRouter());
    app.use('/api/platform', platform.createLandingRouter());
    app.use('/api/superadmin', createSuperadminRouter());
    app.use('/api/community', createCommunityRouter());
    marketplaceRouter = createMarketplaceRouter();
    app.use('/api/marketplace', marketplaceRouter);
    app.use('/api/client', publicQuota);
    app.use('/api/client', createClientPortalRouter());
    app.use('/api/developers', publicQuota);
    app.use(createSdkDownloadsRouter());

    app.get(['/sitemap', '/sitemap.xml.gz'], (_req, res) => {
      res.redirect(301, '/sitemap.xml');
    });
    app.get('/robots.txt', async (req, res, next) => {
      if (resolveAppHost(req) !== 'cms') return next();
      res
        .type('text/plain')
        .set('Cache-Control', 'public, max-age=3600')
        .send(await landingRobotsTxt(marketFromHost(requestHostHeader(req))));
    });
    app.get('/:key.txt', async (req, res, next) => {
      if (resolveAppHost(req) !== 'cms') return next();
      try {
        const seo = await getLandingSeo();
        const key = (seo.indexNowKey || '').trim();
        if (!key || req.params.key !== key) return next();
        res.type('text/plain').send(key);
      } catch {
        next();
      }
    });
    app.get('/sitemap_index.xml', async (req, res, next) => {
      if (resolveAppHost(req) !== 'cms') return next();
      sendXml(res, await landingSitemapIndexXml(marketFromHost(requestHostHeader(req))));
    });
    app.get('/sitemap.xml', async (req, res, next) => {
      if (resolveAppHost(req) !== 'cms') return next();
      sendXml(res, await landingSitemapXml(marketFromHost(requestHostHeader(req))));
    });
    app.get('/sitemap-landing.xml', async (req, res) => {
      sendXml(res, await landingSitemapXml(marketFromHost(requestHostHeader(req))));
    });
    app.get('/llms.txt', (_req, res) => {
      res.type('text/plain').sendFile(path.resolve(__dirname, 'public/llms.txt'), (err) => {
        if (err) res.status(404).type('text/plain').send('Not found');
      });
    });
  }

  if (!cmsOnly) {
    const { db } = await import('./server/db/client');
    const { mpProducts } = await import('./server/db/schema');
    const { eq: eqDb } = await import('drizzle-orm');
    const sendXmlHost = (res: express.Response, xml: string) =>
      res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);

    app.get('/robots.txt', async (req, res, next) => {
      const appHost = resolveAppHost(req);
      if (appHost !== 'marketplace' && appHost !== 'developers' && appHost !== 'community') return next();
      const host = requestHostHeader(req);
      const base = `https://${host}`;
      const lines = [
        'User-agent: *',
        'Allow: /',
        'Allow: /product/',
        'Allow: /docs',
        'Disallow: /api/',
        'Disallow: /developer/dashboard',
        'Disallow: /administrator',
        '',
        `Sitemap: ${base}/sitemap.xml`,
        '',
      ];
      res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(lines.join('\n'));
    });
    app.get('/sitemap.xml', async (req, res, next) => {
      const appHost = resolveAppHost(req);
      if (appHost !== 'marketplace' && appHost !== 'developers' && appHost !== 'community') return next();
      const host = requestHostHeader(req);
      const base = `https://${host}`;
      const today = new Date().toISOString().slice(0, 10);
      const urls: { loc: string; priority: string }[] = [{ loc: `${base}/`, priority: '1.0' }];
      if (appHost === 'marketplace') {
        urls.push(
          { loc: `${base}/catalog`, priority: '0.85' },
          { loc: `${base}/developer`, priority: '0.8' },
        );
        try {
          const products = await db.select().from(mpProducts).where(eqDb(mpProducts.status, 'published'));
          for (const p of products.slice(0, 500)) {
            urls.push({ loc: `${base}/product/${p.slug}`, priority: '0.7' });
          }
        } catch {
          /* ignore */
        }
      }
      if (appHost === 'developers') {
        urls.push(
          { loc: `${base}/docs/introduction`, priority: '0.9' },
          { loc: `${base}/docs`, priority: '0.8' },
        );
      }
      sendXmlHost(
        res,
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map(
            (u) =>
              `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>${u.priority}</priority></url>`,
          )
          .join('\n')}\n</urlset>`,
      );
    });
    app.use('/api/catalog.json', (req, res, next) => {
      req.url = '/catalog.json';
      marketplaceRouter(req, res, next);
    });
  }

  app.use(createModulesPublicRouter());
  app.use('/api/public', createPublicCmsRouter());
  app.use('/api/admin/google', createGoogleOAuthRouter());
  app.use('/api/admin', createAdminAccountRouter());
  app.use('/api/admin', createAdminUsersRouter());
  app.use('/api/admin', createAdminSystemRouter());
  app.use('/api/admin', createModulesAdminRouter());
  app.use('/api/admin', createAdminCmsRouter());
  app.use(createSeoPublicRouter());

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route API inconnue' }));
  app.use('/api', apiErrorHandler);

  const isAdminPath = (p: string) => p === '/administrator' || p.startsWith('/administrator/');
  const isSuperadminPath = (p: string) => p === '/hamdisup90' || p.startsWith('/hamdisup90/');
  const isClientPath = (p: string) => p === '/espace-client' || p.startsWith('/espace-client/');
  const isDemoPath = (p: string) => p === '/demo' || p.startsWith('/demo/');

  const htmlForHost = (host: ReturnType<typeof resolveAppHost>, admin: boolean, p: string) => {
    if (admin) return 'administrator.html';
    if (cmsOnly) return 'index.html';
    if (host === 'community') return 'community.html';
    if (host === 'marketplace') return 'marketplace.html';
    if (host === 'developers') return 'developers.html';
    if (host === 'cms' && isSuperadminPath(p)) return 'superadmin.html';
    if (host === 'cms' && isClientPath(p)) return 'client.html';
    if (isDemoPath(p)) return 'index.html';
    return 'landing.html';
  };

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    const htmlCache = new Map<string, { mtime: number; html: string }>();
    const loadHtml = async (file: string) => {
      const full = path.join(distDir, file);
      try {
        const { mtimeMs } = await fs.stat(full);
        const cur = htmlCache.get(file);
        if (!cur || mtimeMs !== cur.mtime) {
          htmlCache.set(file, { mtime: mtimeMs, html: await fs.readFile(full, 'utf-8') });
        }
      } catch (e) {
        if (!htmlCache.get(file)?.html) throw e;
      }
      return htmlCache.get(file)!.html;
    };
    await loadHtml('index.html').catch(() => undefined);
    if (!cmsOnly) {
      await loadHtml('landing.html').catch(() => undefined);
      await loadHtml('superadmin.html').catch(() => undefined);
    }
    app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
    app.use('/assets', (_req, res) => res.status(404).end());
    app.use(express.static(distDir, { index: false }));
    app.get('*', async (req, res, next) => {
      try {
        const host = resolveAppHost(req);
        if (isAdminPath(req.path)) {
          res.setHeader('Cache-Control', 'no-store');
          return res.sendFile(path.join(distDir, 'administrator.html'));
        }
        if (cmsOnly) {
          res.setHeader('Cache-Control', 'no-cache');
          const cmsPath = req.path || '/';
          const page = await injectMaintenance(
            req,
            await injectTheme(await injectSeo(await loadHtml('index.html'), cmsPath)),
          );
          if (page.notice) res.status(503).setHeader('Retry-After', '600');
          return res.type('html').send(injectDistroScript(page.html, true));
        }
        if (host !== 'cms') {
          res.setHeader('Cache-Control', 'no-cache');
          const reqHost = requestHostHeader(req);
          const country = countryForRequest(req, reqHost, resolveGeoFromIp(clientIp(req)).country || '');
          let html = injectCountryScript(await loadHtml(htmlForHost(host, false, req.path)), country);
          try {
            const { getLandingSeo, injectGa4 } = await import('./server/superadmin/landingSeo');
            html = injectGa4(html, (await getLandingSeo()).ga4Id);
          } catch {
            /* ignore */
          }
          return res.type('html').send(html);
        }
        if (isSuperadminPath(req.path)) {
          res.setHeader('Cache-Control', 'no-store');
          return res.type('html').send(await loadHtml('superadmin.html'));
        }
        if (isClientPath(req.path)) {
          res.setHeader('Cache-Control', 'no-store');
          const reqHost = requestHostHeader(req);
          const country = countryForRequest(req, reqHost, resolveGeoFromIp(clientIp(req)).country || '');
          return res.type('html').send(injectCountryScript(await loadHtml('client.html'), country));
        }
        res.setHeader('Cache-Control', 'no-cache');
        if (!isDemoPath(req.path)) {
          const reqHost = requestHostHeader(req);
          const country = countryForRequest(req, reqHost, resolveGeoFromIp(clientIp(req)).country || '');
          return res
            .type('html')
            .send(await withLandingMarket(await loadHtml('landing.html'), country, reqHost, req.path || '/'));
        }
        const cmsPath = req.path === '/demo' || req.path === '/demo/' ? '/' : req.path.slice('/demo'.length) || '/';
        const page = await injectMaintenance(req, await injectTheme(await injectSeo(await loadHtml('index.html'), cmsPath)));
        if (page.notice) res.status(503).setHeader('Retry-After', '600');
        res.type('html').send(page.html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      try {
        const host = resolveAppHost(req);
        const admin = isAdminPath(req.path);
        const file = htmlForHost(host, admin, req.path);
        const raw = await fs.readFile(path.resolve(__dirname, file), 'utf-8');
        let html = await vite.transformIndexHtml(req.originalUrl, raw);
        if (cmsOnly || admin) {
          const cmsPath = admin ? '/' : req.path || '/';
          if (admin) return res.status(200).type('html').send(injectDistroScript(html, cmsOnly));
          const page = await injectMaintenance(req, await injectTheme(await injectSeo(html, cmsPath)));
          if (page.notice) res.setHeader('Retry-After', '600');
          return res.status(page.notice ? 503 : 200).type('html').send(injectDistroScript(page.html, cmsOnly));
        }
        const reqHost = requestHostHeader(req);
        const geoCountry = countryForRequest(req, reqHost, resolveGeoFromIp(clientIp(req)).country || '');
        if (file === 'landing.html') {
          html = await withLandingMarket(html, geoCountry, reqHost, req.path || '/');
        } else {
          if (host === 'marketplace' || host === 'developers' || host === 'community' || file === 'client.html') {
            html = injectCountryScript(html, geoCountry);
          }
          if (host !== 'cms' || (!admin && !isSuperadminPath(req.path) && !isDemoPath(req.path))) {
            try {
              const { getLandingSeo, injectGa4 } = await import('./server/superadmin/landingSeo');
              html = injectGa4(html, (await getLandingSeo()).ga4Id);
            } catch {
              /* ignore */
            }
          }
        }
        if (host !== 'cms' || admin || isSuperadminPath(req.path) || !isDemoPath(req.path)) {
          return res.status(200).type('html').send(html);
        }
        const cmsPath = req.path === '/demo' || req.path === '/demo/' ? '/' : req.path.slice('/demo'.length) || '/';
        const page = await injectMaintenance(req, await injectTheme(await injectSeo(html, cmsPath)));
        if (page.notice) res.setHeader('Retry-After', '600');
        res.status(page.notice ? 503 : 200).type('html').send(page.html);
      } catch (e) {
        next(e);
      }
    });
  }

  if (!cmsOnly) {
    const { startDemoResetScheduler } = await import('./server/demo/cmsReset');
    const { startDailyImproveScheduler } = await import('./server/platform/dailyImprove');
    void startDemoResetScheduler().catch((e) => console.error('[demo] scheduler', e));
    startDailyImproveScheduler();
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur Snapify démarré sur http://0.0.0.0:${PORT}`);
  });

  const prune = () =>
    runRetention()
      .then((r) => {
        const total = Object.values(r).reduce((a, b) => a + b, 0);
        if (total) console.log('[rétention] purge quotidienne', r);
      })
      .catch((e) => console.error('[rétention] purge impossible', e));
  void prune();
  const pruneTimer = setInterval(prune, 24 * 3600 * 1000);
  pruneTimer.unref();

  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} reçu, arrêt en cours`);
    clearInterval(pruneTimer);
    server.close(() => {
      closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((e) => {
  console.error('[server] démarrage impossible', e);
  process.exit(1);
});
