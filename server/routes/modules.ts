/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { MODULE_ID_PATTERN, SNAPIFY_MODULE_API_VERSION, type ModuleCookie } from '../../sdk/index';
import { clientIp } from '../security/ip';
import { maintenanceFor } from './publicCms';
import { compareVersions, PACKAGE_EXTENSIONS, PackageError, satisfies } from '../../sdk/package';
import { asyncRouter, HttpError } from '../http';
import { assertPerm, requireAuth, requirePerm, type AuthedRequest } from '../middleware/adminAuth';

const canManageModules = requirePerm('modules.manage');
const canManageThemes = requirePerm('appearance.themes');
import {
  activateTheme,
  dispatchModuleAdminRequest,
  dispatchModuleRequest,
  installedVersions,
  installStaged,
  isDevMode,
  listModules,
  listThemes,
  moduleAsset,
  moduleDetail,
  ModuleError,
  setModuleEnabled,
  setModuleLicense,
  stagedKind,
  stagePackage,
  themeDetail,
  uninstallModule,
  updateModuleSettings,
} from '../modules/manager';
import { downloadPackage, galleryUrls, getCatalog, localGalleryImage, localScreenshot, screenshotUrl } from '../modules/marketplace';
import { getModulePurchase, latestPaidLicenseForModule, markModulePurchasePaid, startModuleCheckout, catalogPriceMillimes } from '../modules/purchases';
import type { MarketplaceListing } from '../modules/types';
import { formatDt } from '../platform/settings';

function moduleId(req: Request): string {
  const id = String(req.params.id || '');
  if (!MODULE_ID_PATTERN.test(id)) throw new HttpError(400, 'Identifiant de module invalide');
  return id;
}

function moduleErrors(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof ModuleError) return res.status(err.status).json({ error: err.message });
  if (err instanceof PackageError) return res.status(400).json({ error: err.message });
  next(err);
}

/** Administration : /api/admin/modules, /api/admin/themes et /api/admin/marketplace. */
export function createModulesAdminRouter(): Router {
  const router = asyncRouter();

  router.get('/modules', requireAuth(), async (_req, res) => {
    res.json({ modules: await listModules(), devMode: isDevMode() });
  });

  router.post('/modules/upload', requirePerm('modules.manage', 'appearance.themes'), async (req, res) => {
    const { filename, dataBase64 } = req.body || {};
    if (typeof filename !== 'string' || !PACKAGE_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))) {
      throw new HttpError(400, `Fichier ${PACKAGE_EXTENSIONS.join(' ou ')} attendu`);
    }
    if (typeof dataBase64 !== 'string' || !dataBase64) throw new HttpError(400, 'Fichier vide');
    res.json(stagePackage(Buffer.from(dataBase64, 'base64'), 'upload'));
  });

  router.post('/modules/install', requirePerm('modules.manage', 'appearance.themes'), async (req: AuthedRequest, res) => {
    const token = String(req.body?.token || '');
    if (!token) throw new HttpError(400, 'Jeton d’installation manquant');
    const kind = stagedKind(token);
    if (kind) {
      assertPerm(req, kind === 'theme' ? 'appearance.themes' : 'modules.manage', kind === 'theme' ? 'Vous n’êtes pas autorisé à installer des thèmes' : 'Vous n’êtes pas autorisé à installer des modules');
      res.locals.audit = { action: kind === 'theme' ? 'theme.install' : 'module.install' };
    }
    let installed = await installStaged(token);
    // Licence déjà achetée depuis le backoffice (Flouci) → application automatique
    if (installed.kind === 'module' && installed.pricing === 'paid') {
      const paid = await latestPaidLicenseForModule(installed.id);
      if (paid?.licenseKey && installed.license.state !== 'valid') {
        try {
          installed = await setModuleLicense(installed.id, paid.licenseKey);
        } catch {
          /* licence appliquée manuellement plus tard */
        }
      }
    }
    res.json(installed);
  });

  router.get('/modules/:id', requireAuth(), async (req, res) => {
    res.json(await moduleDetail(moduleId(req)));
  });

  router.put('/modules/:id/settings', requirePerm('modules.settings'), async (req, res) => {
    const result = await updateModuleSettings(moduleId(req), req.body?.settings);
    if (result.errors) return res.status(400).json({ error: 'Certains réglages sont invalides', fields: result.errors });
    res.json(result);
  });

  router.post('/modules/:id/enabled', canManageModules, async (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') throw new HttpError(400, 'Valeur attendue : enabled');
    res.json(await setModuleEnabled(moduleId(req), req.body.enabled));
  });

  router.post('/modules/:id/license', canManageModules, async (req, res) => {
    const key = String(req.body?.key || '').trim();
    if (!key) throw new HttpError(400, 'Clé de licence manquante');
    res.json(await setModuleLicense(moduleId(req), key));
  });

  router.delete('/modules/:id', canManageModules, async (req, res) => {
    await uninstallModule(moduleId(req));
    res.status(204).end();
  });

  router.get('/marketplace', requirePerm('modules.manage', 'appearance.themes'), async (req, res) => {
    const catalog = await getCatalog(req.query.refresh === '1');
    const installed = installedVersions();
    const listing: MarketplaceListing = {
      source: catalog.source,
      url: catalog.url,
      error: catalog.error,
      devMode: isDevMode(),
      modules: await Promise.all(
        catalog.modules.map(async (m) => {
          const installedVersion = installed.get(m.id) ?? null;
          const paid = m.pricing === 'paid' ? await latestPaidLicenseForModule(m.id) : null;
          const priceMillimes = catalogPriceMillimes(m);
          return {
            ...m,
            kind: m.kind ?? 'module',
            screenshot: screenshotUrl(catalog, m),
            gallery: galleryUrls(catalog, m),
            priceMillimes,
            priceLabel: m.pricing === 'paid' ? formatDt(priceMillimes) : 'Gratuit',
            purchased: !!paid,
            installedVersion,
            updateAvailable: !!installedVersion && compareVersions(m.version, installedVersion) > 0,
            compatible: satisfies(SNAPIFY_MODULE_API_VERSION, m.engines.snapify),
          };
        })
      ),
    };
    res.json(listing);
  });

  router.get('/marketplace/purchases/:purchaseId', requirePerm('modules.manage'), async (req, res) => {
    const p = await getModulePurchase(String(req.params.purchaseId || ''));
    if (!p) throw new HttpError(404, 'Achat introuvable');
    // Si paiement mock / retour navigateur avant webhook
    if (p.status === 'pending' && p.paymentId?.startsWith('mock_')) {
      const paid = await markModulePurchasePaid(p.paymentId);
      if (paid) return res.json({ purchase: paid });
    }
    res.json({ purchase: p });
  });

  router.post('/marketplace/:id/stage', requirePerm('modules.manage', 'appearance.themes'), async (req, res) => {
    res.json(stagePackage(await downloadPackage(moduleId(req)), 'marketplace'));
  });

  /** Achat Flouci d’un module payant du catalogue officiel — depuis le backoffice. */
  router.post('/marketplace/:id/checkout', requirePerm('modules.manage'), async (req: AuthedRequest, res) => {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost');
    const proto = String(req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http'));
    const publicBase = process.env.PUBLIC_URL || `${proto}://${host}`;
    const result = await startModuleCheckout({
      moduleId: moduleId(req),
      publicBase,
      buyerEmail: req.admin?.email,
    });
    res.json({
      purchaseId: result.purchase.id,
      paymentLink: result.paymentLink,
      paymentId: result.paymentId,
      amountMillimes: result.purchase.amountMillimes,
      amountLabel: formatDt(result.purchase.amountMillimes),
      moduleId: result.purchase.moduleId,
      moduleName: result.purchase.moduleName,
    });
  });

  router.get('/themes', requireAuth(), async (_req, res) => {
    res.json({ themes: await listThemes(), devMode: isDevMode() });
  });

  router.get('/themes/:id', requireAuth(), async (req, res) => {
    res.json(await themeDetail(moduleId(req)));
  });

  router.post('/themes/:id/activate', canManageThemes, async (req, res) => {
    res.json(await activateTheme(moduleId(req)));
  });

  router.put('/themes/:id/settings', requirePerm('appearance.customize'), async (req, res) => {
    const id = moduleId(req);
    await themeDetail(id);
    const result = await updateModuleSettings(id, req.body?.settings);
    if (result.errors) return res.status(400).json({ error: 'Certaines options sont invalides', fields: result.errors });
    res.json(result);
  });

  router.delete('/themes/:id', canManageThemes, async (req, res) => {
    const id = moduleId(req);
    await themeDetail(id);
    await uninstallModule(id);
    res.status(204).end();
  });

  router.all('/modules/:id/api/*', requirePerm('modules.use'), async (req: AuthedRequest, res) => {
    const id = moduleId(req);
    const routePath = `/${req.params[0] ?? ''}`;
    const { status, body } = await dispatchModuleAdminRequest(id, req.method, routePath, {
      query: queryOf(req),
      body: req.body ?? null,
      ip: clientIp(req),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      admin: { id: req.admin!.sub, email: req.admin!.email, name: req.admin!.name },
    });
    if (req.method !== 'GET') res.locals.audit = { action: 'module.data', target: id, detail: { method: req.method, path: routePath } };
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(body);
  });

  router.use(moduleErrors);
  return router;
}

const queryOf = (req: Request) =>
  Object.fromEntries(Object.entries(req.query).filter(([, v]) => typeof v === 'string')) as Record<string, string>;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    if (!name.startsWith('sm_')) continue;
    try {
      out[name] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* cookie illisible ignoré */
    }
  }
  return out;
}

function setModuleCookies(req: Request, res: Response, cookies: ModuleCookie[] | undefined) {
  if (!cookies?.length) return;
  const secure = req.secure;
  res.append(
    'Set-Cookie',
    cookies.map((c) => {
      const parts = [`${c.name}=${encodeURIComponent(c.value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
      if (c.maxAgeSec !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(c.maxAgeSec))}`);
      if (secure) parts.push('Secure');
      return parts.join('; ');
    })
  );
}

/** Fichiers publics des modules (/_modules/<id>/<version>/<fichier>) et leur API (/api/modules/<id>/…). */
export function createModulesPublicRouter(): Router {
  const router = Router();

  router.get('/_marketplace/screenshots/:file', async (req, res) => {
    const data = await localScreenshot(req.params.file);
    if (!data) return res.status(404).type('text/plain').send('Not found');
    res.type(req.params.file.split('.').pop()!);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(data);
  });

  router.get('/_marketplace/gallery/:moduleId/:file', async (req, res) => {
    const data = await localGalleryImage(req.params.moduleId, req.params.file);
    if (!data) return res.status(404).type('text/plain').send('Not found');
    res.type(req.params.file.split('.').pop()!);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(data);
  });

  router.use('/_modules', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const [id, version, file, ...rest] = req.path.split('/').slice(1);
    const data = !rest.length && id && version && file ? moduleAsset(id, version, file) : null;
    if (!data) return res.status(404).type('text/plain').send('Not found');
    res.type(file.split('.').pop()!);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(data);
  });

  router.use('/api/modules/:id', async (req, res, next) => {
    try {
      if (!MODULE_ID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'Module inconnu' });
      if (await maintenanceFor(req)) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Retry-After', '600');
        return res.status(503).json({ error: 'Le site est en maintenance : réessayez dans quelques instants.' });
      }
      const { status, body, cookies } = await dispatchModuleRequest(req.params.id, req.method, req.path || '/', {
        query: queryOf(req),
        body: req.body ?? null,
        ip: clientIp(req),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
        cookies: parseCookies(req.headers.cookie),
      });
      setModuleCookies(req, res, cookies);
      res.setHeader('Cache-Control', 'no-store');
      res.status(status).json(body);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
