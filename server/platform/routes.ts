/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { eq } from 'drizzle-orm';
import { asyncRouter, HttpError } from '../http';
import { db } from '../db/client';
import { platformUsers } from '../db/schema';
import {
  consumeResetToken,
  createPlatformUser,
  createResetToken,
  loginPlatformUser,
  logoutPlatformUser,
  platformAuthOptional,
  requirePlatformUser,
  toPublicUser,
} from './auth';
import { flouciMockAllowed, parseFlouciWebhook, verifyFlouciSignature } from './flouci';
import { fulfillOrderPayment, fulfillPublisherPayment } from '../marketplace/payments';
import { licensePriceMillimes, markLicensePaidByPaymentId, startLicenseCheckout } from './licenseOrders';
import { markModulePurchasePaid } from '../modules/purchases';
import { orderFormOptions } from './hostingProviders';
import { resolveGeoFromIp } from '../geoip';
import { clientIp } from '../security/ip';
import { formatDt } from './settings';
import { demoCredentials as demoCreds } from '../demo/cmsReset';

export function createPlatformAuthRouter() {
  const r = asyncRouter();

  r.get('/me', platformAuthOptional, (req, res) => {
    res.json({ user: req.platformUser ? toPublicUser(req.platformUser) : null });
  });

  r.post('/register', async (req, res) => {
    const { email, password, displayName } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || typeof displayName !== 'string') {
      throw new HttpError(422, 'Champs manquants.');
    }
    const user = await createPlatformUser({ email, password, displayName });
    await loginPlatformUser(req, res, email, password);
    try {
      const { linkClientProfileToUser } = await import('./clients');
      await linkClientProfileToUser(user.email, user.id);
    } catch {
      /* ignore */
    }
    res.status(201).json({ user: toPublicUser(user) });
  });

  r.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(422, 'Champs manquants.');
    const user = await loginPlatformUser(req, res, email, password);
    try {
      const { linkClientProfileToUser } = await import('./clients');
      await linkClientProfileToUser(user.email, user.id);
    } catch {
      /* ignore */
    }
    res.json({ user: toPublicUser(user) });
  });

  r.post('/logout', async (req, res) => {
    await logoutPlatformUser(req, res);
    res.json({ ok: true });
  });

  r.patch('/me', requirePlatformUser, async (req, res) => {
    const { displayName, bio, avatarUrl } = req.body || {};
    const patch: Partial<typeof platformUsers.$inferInsert> = { updatedAt: new Date() };
    if (typeof displayName === 'string' && displayName.trim().length >= 2) patch.displayName = displayName.trim().slice(0, 80);
    if (typeof bio === 'string') patch.bio = bio.slice(0, 500);
    if (avatarUrl === null || typeof avatarUrl === 'string') patch.avatarUrl = avatarUrl;
    const [user] = await db.update(platformUsers).set(patch).where(eq(platformUsers.id, req.platformUser!.id)).returning();
    res.json({ user: toPublicUser(user) });
  });

  r.post('/forgot', async (req, res) => {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const [user] = await db.select().from(platformUsers).where(eq(platformUsers.email, email)).limit(1);
    // Toujours 200 pour ne pas énumérer les comptes
    if (user) {
      await createResetToken(user.id);
      // Le lien est envoyé par e-mail lorsque SMTP est configuré — ne jamais logger le token.
    }
    res.json({ ok: true, message: 'Si un compte existe, un lien de réinitialisation a été généré.' });
  });

  r.post('/reset', async (req, res) => {
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || typeof password !== 'string') throw new HttpError(422, 'Champs manquants.');
    await consumeResetToken(token, password);
    res.json({ ok: true });
  });

  return r;
}

/** Webhook Flouci (corps brut déjà parsé en JSON par express.json). */
export function createFlouciWebhookRouter() {
  const r = asyncRouter();

  r.post('/webhook', async (req, res) => {
    const withRaw = req as unknown as { rawBody?: string };
    const raw = typeof withRaw.rawBody === 'string' ? withRaw.rawBody : JSON.stringify(req.body || {});
    const sig = String(req.headers['x-flouci-signature'] || '');
    const signed = verifyFlouciSignature(raw, sig);
    if (!signed) {
      const event = parseFlouciWebhook(req.body);
      const mockOk =
        flouciMockAllowed() && String(event.payment_id || '').startsWith('mock_');
      if (!mockOk) throw new HttpError(401, 'Signature Flouci invalide');
    }
    const event = parseFlouciWebhook(req.body);
    if (event.success || event.type === 'payment.succeeded') {
      const tracking = event.developer_tracking_id || '';
      const paymentId = event.payment_id || '';
      if (tracking.startsWith('order_')) {
        await fulfillOrderPayment(tracking.slice(6), paymentId);
      } else if (tracking.startsWith('publisher_')) {
        await fulfillPublisherPayment(tracking.slice(10), paymentId);
      } else if (tracking.startsWith('license_')) {
        await markLicensePaidByPaymentId(paymentId || `mock_${tracking}`);
      } else if (tracking.startsWith('module_')) {
        await markModulePurchasePaid(paymentId || `mock_${tracking}`);
      }
    }
    res.json({ ok: true });
  });

  /** Endpoint de confirmation mock (dev) : GET ?payment_id=&tracking= */
  r.get('/mock-complete', async (req, res) => {
    if (!flouciMockAllowed()) throw new HttpError(404, 'Introuvable');
    const tracking = String(req.query.tracking || '');
    const paymentId = String(req.query.payment_id || `mock_${tracking}`);
    if (tracking.startsWith('order_')) await fulfillOrderPayment(tracking.slice(6), paymentId);
    else if (tracking.startsWith('publisher_')) await fulfillPublisherPayment(tracking.slice(10), paymentId);
    else if (tracking.startsWith('module_') || paymentId.startsWith('mock_module_')) {
      await markModulePurchasePaid(paymentId);
    } else if (tracking.startsWith('license_') || paymentId.startsWith('mock_license_')) {
      await markLicensePaidByPaymentId(paymentId);
    } else if (paymentId.startsWith('mock_')) {
      await markLicensePaidByPaymentId(paymentId);
    } else throw new HttpError(422, 'tracking invalide');
    res.json({ ok: true });
  });

  return r;
}

/** Landing snapify.tn : geo, infos démo, checkout licence 699 DT. */
export function createLandingRouter() {
  const r = asyncRouter();

  r.get('/geo', (req, res) => {
    const geo = resolveGeoFromIp(clientIp(req));
    const country = (geo.country || '').toUpperCase();
    res.json({ country: country || null, city: geo.city || null });
  });

  r.get('/order-options', (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const market = host.includes('.fr') || String(req.query.market || '') === 'fr' ? 'fr' : 'tn';
    res.json(orderFormOptions(market));
  });

  r.get('/landing', (_req, res) => {
    const creds = demoCreds();
    const price = licensePriceMillimes();
    res.json({
      email: creds.email,
      password: creds.password,
      demoPath: '/demo/',
      adminPath: '/administrator/login',
      resetHours: Number(process.env.DEMO_CMS_RESET_HOURS) || 24,
      priceMillimes: price,
      priceLabel: formatDt(price),
    });
  });

  r.post('/license/checkout', async (req, res) => {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'snapify.tn').split(',')[0].trim();
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const publicBase = process.env.PLATFORM_PUBLIC_URL || `${proto}://${host}`;
    const b = (req.body || {}) as Record<string, unknown>;
    const s = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
    const geoCountry = (resolveGeoFromIp(clientIp(req)).country || '').toUpperCase();
    const market = host.toLowerCase().includes('.fr') || b.market === 'fr' ? 'fr' : 'tn';
    const result = await startLicenseCheckout({
      name: s('name'),
      email: s('email'),
      domain: s('domain'),
      company: s('company'),
      phone: s('phone'),
      gouvernorat: s('gouvernorat'),
      city: s('city'),
      siteType: s('siteType'),
      domainStatus: s('domainStatus'),
      providerId: s('providerId'),
      providerOther: s('providerOther'),
      hostingType: s('hostingType'),
      accessType: s('accessType'),
      serverIp: s('serverIp'),
      theme: s('theme'),
      message: s('message'),
      acceptTerms: b.acceptTerms === true,
      publicBase,
      market,
      country: geoCountry || (market === 'fr' ? 'FR' : 'TN'),
    });
    res.status(201).json(result);
  });

  return r;
}
