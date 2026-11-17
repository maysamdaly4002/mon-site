/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import crypto from 'crypto';
import { loadSnapshot, updateSnapshot } from '../cms/store';
import type { Request } from 'express';
import type { AnalyticsEvent, CmsSnapshot } from '../cms/types';
import { sendMail } from '../mail';
import { resolveGeoFromIp } from '../geoip';
import { appendAnalyticsEvent } from '../cms/analyticsStore';
import { asyncRouter, HttpError } from '../http';
import { publicModules, publicRecaptchaConfig, publicTheme, verifyRecaptchaToken } from '../modules/manager';
import { hit, rateLimitError } from '../security/rateLimit';
import { clientIp, ipMatches } from '../security/ip';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PREVIEW_COOKIE = 'snapify_preview';

function readCookie(header: string | undefined, name: string): string | undefined {
  const m = (header || '').split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : undefined;
}

/** Visiteur autorisé à voir le site pendant la maintenance (IP autorisée ou lien de prévisualisation). */
function bypassesMaintenance(req: Request, m: CmsSnapshot['settings']['maintenance']): boolean {
  if ((m.allowedIps || []).some((rule) => ipMatches(clientIp(req), rule))) return true;
  const cookie = readCookie(req.headers.cookie, PREVIEW_COOKIE);
  return !!m.bypassSecret && !!cookie && cookie.length === m.bypassSecret.length && crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(m.bypassSecret));
}

export interface MaintenanceNotice {
  title: string;
  message: string;
  logo: string;
  siteName: string;
}

/** Page de maintenance à montrer à ce visiteur, ou `null` s'il doit voir le site. */
export async function maintenanceFor(req: Request): Promise<MaintenanceNotice | null> {
  const s = await loadSnapshot();
  const m = s.settings.maintenance;
  if (!m.enabled || bypassesMaintenance(req, m)) return null;
  return { title: m.title, message: m.message, logo: s.branding.logoDarkUrl || '', siteName: s.branding.siteName || '' };
}

/**
 * Annonce la maintenance dès le HTML (statut 503 pour les robots) : la page s'affiche
 * sans attendre l'API et sans dépendre d'une configuration mise en cache.
 */
export async function injectMaintenance(req: Request, html: string): Promise<{ html: string; notice: MaintenanceNotice | null }> {
  const notice = await maintenanceFor(req).catch(() => null);
  if (!notice) return { html, notice };
  const json = JSON.stringify(notice).replace(/</g, '\\u003c');
  return { html: html.replace('</head>', `    <script type="application/json" id="snapify-maintenance">${json}</script>\n  </head>`), notice };
}

export function createPublicCmsRouter() {
  const router = asyncRouter();

  router.get('/maintenance-preview', async (req, res) => {
    const s = await loadSnapshot();
    const key = String(req.query.key || '');
    const secret = s.settings.maintenance.bypassSecret;
    if (secret && key.length === secret.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(secret))) {
      res.cookie(PREVIEW_COOKIE, secret, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 7 * 86400000, path: '/' });
    }
    res.redirect('/');
  });

  router.get('/maintenance-status', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const notice = await maintenanceFor(req);
    res.json(notice ? { enabled: true, ...notice } : { enabled: false });
  });

  router.get('/site-config', async (req, res) => {
    const s = await loadSnapshot();
    const m = s.settings.maintenance;
    const maintenanceOn = m.enabled && !bypassesMaintenance(req, m);
    res.set('Cache-Control', m.enabled ? 'private, no-store' : `public, max-age=${s.system.performance.publicCacheSeconds}`);
    res.json({
      general: s.general,
      branding: s.branding,
      menus: s.menus,
      widgetAreas: s.widgetAreas,
      floatingButtons: s.floatingButtons.filter((b) => b.enabled),
      modules: await publicModules(),
      theme: await publicTheme(),
      settings: {
        publicUrl: s.settings.publicUrl,
        maintenance: { enabled: maintenanceOn, title: m.title, message: m.message },
        cookieBannerEnabled: s.settings.cookieBannerEnabled,
        analyticsEnabled: s.settings.analyticsEnabled,
        seo: {
          titleSeparator: s.settings.seo.titleSeparator,
          titleSuffix: s.settings.seo.titleSuffix,
          defaultOgImage: s.settings.seo.defaultOgImage,
          googleVerification: s.settings.seo.googleVerification,
          bingVerification: s.settings.seo.bingVerification,
        },
      },
      redirects: s.redirects,
      newsletterEnabled: s.newsletter.enabled,
    });
  });

  router.get('/pages/by-path', async (req, res) => {
    const raw = String(req.query.path || '/');
    const normalized = raw.endsWith('/') ? raw : `${raw}/`;
    const s = await loadSnapshot();
    const page = s.pages.find((p) => p.path === normalized && p.status === 'published');
    if (!page) throw new HttpError(404, 'Page non trouvée');
    res.json(page);
  });

  /** Fiches des réalisations publiées (pages au modèle « project »). */
  router.get('/projects', async (_req, res) => {
    const s = await loadSnapshot();
    res.set('Cache-Control', `public, max-age=${s.system.performance.publicCacheSeconds}`);
    res.json(
      s.pages
        .filter((p) => p.template === 'project' && p.status === 'published' && p.project)
        .map((p) => ({ id: p.id, path: p.path, title: p.title, ...p.project! }))
    );
  });

  router.get('/posts', async (_req, res) => {
    const s = await loadSnapshot();
    res.json(
      s.posts
        .filter((p) => p.status === 'published')
        .map(({ blocks, ...meta }) => meta)
    );
  });

  router.get('/posts/:slug', async (req, res) => {
    const s = await loadSnapshot();
    const post = s.posts.find((p) => p.slug === req.params.slug && p.status === 'published');
    if (!post) throw new HttpError(404, 'Article non trouvé');
    res.json(post);
  });

  router.get('/forms/:id', async (req, res) => {
    const s = await loadSnapshot();
    const form = s.forms.find((f) => f.id === req.params.id && f.enabled);
    if (!form) throw new HttpError(404, 'Formulaire introuvable');
    const { recipientEmails, ...publicForm } = form;
    const recaptcha = publicRecaptchaConfig();
    res.json(recaptcha ? { ...publicForm, recaptcha } : publicForm);
  });

  router.post('/forms/:id/submit', async (req, res) => {
    const s = await loadSnapshot();
    const form = s.forms.find((f) => f.id === req.params.id && f.enabled);
    if (!form) throw new HttpError(404, 'Formulaire introuvable');

    const body = (req.body || {}) as Record<string, unknown>;
    if (form.honeypotField && body[form.honeypotField]) return res.json({ ok: true, redirect: form.successPath });
    const quota = s.system.limits.formSubmissions;
    const allowed = hit(`form:${clientIp(req)}`, quota.max, quota.windowMinutes * 60_000);
    if (!allowed.ok) throw rateLimitError(res, allowed, 'Trop de demandes envoyées');

    if (publicRecaptchaConfig()) {
      const token = typeof body['g-recaptcha-response'] === 'string' ? body['g-recaptcha-response'] : typeof body.recaptchaToken === 'string' ? body.recaptchaToken : '';
      const check = await verifyRecaptchaToken(token, clientIp(req));
      if (!check.ok) throw new HttpError(400, check.error);
    }

    const payload: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const field of form.fields) {
      const v = body[field.name];
      const empty = v === undefined || v === null || v === '' || v === false;
      if (field.required && empty) errors[field.name] = `${field.label} est requis`;
      else if (!empty && field.type === 'email' && !EMAIL_RE.test(String(v))) errors[field.name] = 'E-mail invalide';
      if (!empty) payload[field.name] = typeof v === 'string' ? v.slice(0, 5000) : v;
    }
    // Champs historiques du formulaire React non déclarés dans le CMS : conservés mais bornés.
    for (const [k, v] of Object.entries(body)) {
      if (k !== form.honeypotField && !(k in payload) && typeof v === 'string' && Object.keys(payload).length < 40) {
        payload[k] = v.slice(0, 2000);
      }
    }
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Formulaire incomplet', fields: errors });

    await updateSnapshot((snap) => {
      snap.formSubmissions.unshift({
        id: crypto.randomUUID(),
        formId: form.id,
        payload,
        ip: s.system.privacy.storeSubmitterIp ? clientIp(req) : undefined,
        userAgent: s.system.privacy.storeSubmitterIp ? String(req.headers['user-agent'] || '').slice(0, 300) : undefined,
        createdAt: new Date().toISOString(),
        read: false,
      });
    });

    const rows = Object.entries(payload)
      .map(([k, v]) => {
        const label = form.fields.find((f) => f.name === k)?.label || k;
        return `<tr><td style="padding:6px 12px;color:#64748b">${escapeHtml(label)}</td><td style="padding:6px 12px">${escapeHtml(v)}</td></tr>`;
      })
      .join('');
    sendMail({
      to: form.recipientEmails,
      subject: `[${s.branding.siteName}] ${form.name}`,
      html: `<h2 style="font-family:sans-serif">${escapeHtml(form.name)}</h2><table style="font-family:sans-serif;font-size:14px">${rows}</table>`,
      kind: 'form',
      replyTo: typeof payload.email === 'string' && EMAIL_RE.test(payload.email) ? payload.email : undefined,
    });

    res.json({ ok: true, redirect: form.successPath });
  });

  router.post('/newsletter/subscribe', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'E-mail invalide');
    const s = await loadSnapshot();
    if (!s.newsletter.enabled) throw new HttpError(403, 'Newsletter désactivée');
    const quota = s.system.limits.newsletter;
    const allowed = hit(`newsletter:${clientIp(req)}`, quota.max, quota.windowMinutes * 60_000);
    if (!allowed.ok) throw rateLimitError(res, allowed, 'Trop de tentatives');

    const existing = s.subscribers.find((x) => x.email === email);
    if (existing?.status === 'active') return res.json({ ok: true, pending: false });

    const token = crypto.randomBytes(24).toString('hex');
    await updateSnapshot((snap) => {
      const sub = snap.subscribers.find((x) => x.email === email);
      const status = snap.newsletter.doubleOptIn ? 'pending' : 'active';
      if (sub) {
        sub.status = status;
        sub.confirmToken = snap.newsletter.doubleOptIn ? token : undefined;
      } else {
        snap.subscribers.unshift({
          id: crypto.randomUUID(),
          email,
          status,
          confirmToken: snap.newsletter.doubleOptIn ? token : undefined,
          source: 'website',
          createdAt: new Date().toISOString(),
        });
      }
    });

    if (s.newsletter.doubleOptIn) {
      const base = s.settings.publicUrl.replace(/\/$/, '');
      await sendMail({
        to: email,
        subject: s.newsletter.welcomeEmailSubject || `Confirmez votre inscription — ${s.branding.siteName}`,
        html: `<p style="font-family:sans-serif">Merci pour votre inscription. Confirmez votre adresse :</p><p><a href="${base}/api/public/newsletter/confirm?token=${token}">Confirmer mon e-mail</a></p>`,
        kind: 'newsletter',
      });
    }
    res.json({ ok: true, pending: s.newsletter.doubleOptIn });
  });

  router.get('/newsletter/confirm', async (req, res) => {
    const token = String(req.query.token || '');
    const s = await loadSnapshot();
    const sub = token ? s.subscribers.find((x) => x.confirmToken === token) : undefined;
    const page = (title: string, text: string) =>
      `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#F5F7FA;color:#0B1528"><div style="text-align:center;max-width:420px;padding:2rem"><h1>${title}</h1><p>${text}</p><a href="/" style="color:#00A89D">Retour au site</a></div></body></html>`;
    if (!sub) return res.status(404).send(page('Lien invalide', 'Ce lien de confirmation est expiré ou a déjà été utilisé.'));
    await updateSnapshot((snap) => {
      const t = snap.subscribers.find((x) => x.id === sub.id);
      if (t) {
        t.status = 'active';
        t.confirmedAt = new Date().toISOString();
        t.confirmToken = undefined;
      }
    });
    res.send(page('Inscription confirmée', 'Merci, vous recevrez désormais notre newsletter.'));
  });

  router.post('/analytics/event', async (req, res) => {
    res.status(204).end();
    const s = await loadSnapshot();
    if (!s.settings.analyticsEnabled) return;
    const body = (req.body || {}) as Partial<AnalyticsEvent>;
    const p = String(body.path || '/').slice(0, 300);
    if (p.startsWith('/administrator') || /bot|crawler|spider|headless/i.test(String(req.headers['user-agent']))) return;

    const geo = resolveGeoFromIp(req.ip || '');
    const kind = body.kind === 'leave' ? 'leave' : 'view';
    await appendAnalyticsEvent({
      id: crypto.randomUUID(),
      kind,
      sessionId: String(body.sessionId || '').slice(0, 64) || crypto.randomUUID(),
      path: p,
      referrer: body.referrer ? String(body.referrer).slice(0, 300) : undefined,
      country: (req.headers['cf-ipcountry'] as string) || geo.country,
      city: geo.city,
      device: ['mobile', 'tablet', 'desktop'].includes(String(body.device)) ? body.device! : 'unknown',
      durationSec: kind === 'leave' ? Math.max(0, Math.min(Number(body.durationSec) || 0, 7200)) : undefined,
      ts: new Date().toISOString(),
    });
  });

  return router;
}
