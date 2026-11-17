/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import crypto from 'crypto';
import type { Request } from 'express';
import { loadSnapshot, updateSnapshot } from '../cms/store';
import type { CmsSnapshot } from '../cms/types';
import { requirePerm, type AuthedRequest } from '../middleware/adminAuth';
import { asyncRouter, HttpError } from '../http';
import { audit } from '../security/audit';
import { decryptSecret, encryptSecret } from '../security/secrets';

const canSeo = requirePerm('seo.edit');
const canManage = requirePerm('settings.manage');

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/webmasters.readonly'].join(' ');
const CALLBACK_PATH = '/api/admin/google/callback';
const CLIENT_ID_RE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

const pendingStates = new Map<string, { exp: number; redirectUri: string; userId?: string; userEmail?: string }>();

type CredentialSource = 'settings' | 'env' | 'none';

function credentials(s: CmsSnapshot): { clientId: string; clientSecret: string; source: CredentialSource } {
  const secret = decryptSecret(s.google.oauthClientSecretEnc);
  if (s.google.oauthClientId && secret) return { clientId: s.google.oauthClientId, clientSecret: secret, source: 'settings' };
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, source: 'env' };
  }
  return { clientId: '', clientSecret: '', source: 'none' };
}

export const googleOAuthConfigured = (s: CmsSnapshot) => credentials(s).source !== 'none';

/**
 * Origine déclarée chez Google : celle de l'URL publique, ou l'hôte courant s'il s'agit d'un poste local.
 * Un en-tête Host arbitraire n'est jamais repris (empoisonnement de l'URI de retour).
 */
function siteOrigin(req: Request, s: CmsSnapshot): string {
  const publicUrl = new URL(s.settings.publicUrl);
  const host = String(req.headers.host || '');
  const hostname = host.replace(/:\d+$/, '');
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `${req.protocol}://${host}`;
  return publicUrl.origin;
}

/** GOOGLE_REDIRECT_URI ne s'applique qu'avec les identifiants du .env, déclarés ensemble chez Google. */
function redirectUriFor(req: Request, s: CmsSnapshot): string {
  if (credentials(s).source === 'env' && process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${siteOrigin(req, s)}${CALLBACK_PATH}`;
}

const refreshToken = (s: CmsSnapshot) => (s.google.oauthRefreshToken ? (decryptSecret(s.google.oauthRefreshToken) ?? s.google.oauthRefreshToken) : null);

type TokenResponse = { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number; error?: string; error_description?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  return (await r.json()) as TokenResponse;
}

let accessCache: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (accessCache && accessCache.exp > Date.now() + 30_000) return accessCache.token;
  const s = await loadSnapshot();
  const refresh = refreshToken(s);
  if (!refresh) throw new HttpError(400, 'Compte Google non connecté');
  const { clientId, clientSecret } = credentials(s);
  if (!clientId) throw new HttpError(400, 'Identifiants OAuth Google non configurés');
  const json = await tokenRequest({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: 'refresh_token' });
  if (!json.access_token) {
    if (json.error === 'invalid_grant') {
      throw new HttpError(
        401,
        'Google a révoqué l’accès (application en mode « Test » : l’autorisation expire après 7 jours, ou accès retiré depuis votre compte Google). Publiez l’application puis reconnectez le compte.',
        'GOOGLE_REAUTH'
      );
    }
    throw new HttpError(502, json.error_description || 'Jeton Google refusé, reconnectez le compte', 'GOOGLE_REAUTH');
  }
  accessCache = { token: json.access_token, exp: Date.now() + (json.expires_in || 3600) * 1000 };
  return json.access_token;
}

async function googleFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await r.json()) as T & { error?: { message?: string; status?: string; details?: { reason?: string }[] } };
  if (!r.ok) {
    const msg = json.error?.message || '';
    if (/has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(msg) || json.error?.details?.some((d) => d.reason === 'SERVICE_DISABLED')) {
      throw new HttpError(
        502,
        'L’API « Google Search Console » n’est pas activée dans votre projet Google Cloud. Activez-la puis réessayez dans une minute.',
        'GOOGLE_API_DISABLED'
      );
    }
    throw new HttpError(502, msg || `Erreur API Google (${r.status})`);
  }
  return json;
}

/** Vérifie un couple ID client / code secret auprès de Google sans connexion : un code bidon renvoie invalid_grant si le client est valide. */
async function probeCredentials(clientId: string, clientSecret: string, redirectUri: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const json = await tokenRequest({ client_id: clientId, client_secret: clientSecret, code: 'snapify-credential-check', grant_type: 'authorization_code', redirect_uri: redirectUri });
    if (json.error === 'invalid_grant') return { ok: true };
    if (json.error === 'invalid_client') {
      return {
        ok: false,
        error: /not found/i.test(json.error_description || '') ? 'ID client introuvable chez Google : vérifiez qu’il est copié en entier.' : 'Code secret refusé par Google : copiez-le à nouveau depuis la console.',
      };
    }
    if (json.error === 'redirect_uri_mismatch') return { ok: false, error: 'L’URI de redirection n’est pas déclarée dans l’ID client.' };
    return { ok: false, error: json.error_description || json.error || 'Réponse inattendue de Google' };
  } catch {
    return { ok: false, error: 'Impossible de joindre Google depuis le serveur (connexion Internet ou pare-feu).' };
  }
}

function emailFromIdToken(idToken?: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8')) as { email?: string };
    return payload.email;
  } catch {
    return undefined;
  }
}

export function createGoogleOAuthRouter() {
  const router = asyncRouter();

  router.get('/status', canSeo, async (req, res) => {
    const s = await loadSnapshot();
    const creds = credentials(s);
    const redirectUri = redirectUriFor(req, s);
    res.json({
      configured: creds.source !== 'none',
      source: creds.source,
      clientId: creds.source === 'settings' ? creds.clientId : creds.source === 'env' ? creds.clientId.replace(/^(\d{4})\d+/, '$1…') : '',
      connected: s.google.connected && !!refreshToken(s),
      accountEmail: s.google.accountEmail,
      property: s.google.searchConsoleProperty,
      lastSyncAt: s.google.lastSyncAt,
      redirectUri,
      javascriptOrigin: new URL(redirectUri).origin,
      publicUrl: s.settings.publicUrl,
      verificationTag: !!s.settings.seo.googleVerification,
    });
  });

  router.post('/credentials/test', canManage, async (req, res) => {
    const s = await loadSnapshot();
    const clientId = String(req.body?.clientId || '').trim();
    const secret = String(req.body?.clientSecret || '').trim() || decryptSecret(s.google.oauthClientSecretEnc) || '';
    if (!CLIENT_ID_RE.test(clientId)) throw new HttpError(400, 'L’ID client doit se terminer par « .apps.googleusercontent.com »');
    if (!secret) throw new HttpError(400, 'Code secret requis');
    res.locals.audit = false;
    res.json(await probeCredentials(clientId, secret, redirectUriFor(req, s)));
  });

  router.put('/credentials', canManage, async (req: AuthedRequest, res) => {
    const s = await loadSnapshot();
    const clientId = String(req.body?.clientId || '').trim();
    const typed = String(req.body?.clientSecret || '').trim();
    const secret = typed || (clientId === s.google.oauthClientId ? decryptSecret(s.google.oauthClientSecretEnc) : '') || '';
    if (!CLIENT_ID_RE.test(clientId)) throw new HttpError(400, 'L’ID client doit se terminer par « .apps.googleusercontent.com »');
    if (!secret) throw new HttpError(400, 'Code secret requis');
    const probe = await probeCredentials(clientId, secret, redirectUriFor(req, s));
    if (!probe.ok) throw new HttpError(400, probe.error || 'Identifiants refusés par Google');
    const changedClient = clientId !== s.google.oauthClientId;
    accessCache = null;
    await updateSnapshot((snap) => {
      snap.google.oauthClientId = clientId;
      snap.google.oauthClientSecretEnc = encryptSecret(secret);
      // Un jeton n'est valable que pour le client qui l'a émis.
      if (changedClient) {
        snap.google.connected = false;
        delete snap.google.oauthRefreshToken;
        delete snap.google.accountEmail;
      }
    });
    res.locals.audit = { action: 'seo.google_credentials', detail: { clientId: clientId.split('-')[0] } };
    res.json({ ok: true });
  });

  router.delete('/credentials', canManage, async (_req, res) => {
    accessCache = null;
    await updateSnapshot((snap) => {
      delete snap.google.oauthClientId;
      delete snap.google.oauthClientSecretEnc;
      delete snap.google.oauthRefreshToken;
      delete snap.google.accountEmail;
      snap.google.connected = false;
    });
    res.locals.audit = { action: 'seo.google_credentials_delete' };
    res.json({ ok: true });
  });

  router.get('/connect', canSeo, async (req: AuthedRequest, res) => {
    const s = await loadSnapshot();
    const { clientId } = credentials(s);
    if (!clientId) throw new HttpError(400, 'Identifiants OAuth Google non configurés');
    const redirectUri = redirectUriFor(req, s);
    const now = Date.now();
    for (const [k, v] of pendingStates) if (v.exp < now) pendingStates.delete(k);
    const state = crypto.randomBytes(24).toString('hex');
    pendingStates.set(state, { exp: now + 10 * 60_000, redirectUri, userId: req.admin?.sub, userEmail: req.admin?.email });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    }).toString();
    res.json({ authUrl: url.toString() });
  });

  router.get('/callback', async (req, res) => {
    const back = (status: string, reason?: string) =>
      res.redirect(`/administrator/seo?tab=google&google=${status}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);
    const state = String(req.query.state || '');
    const pending = pendingStates.get(state);
    pendingStates.delete(state);
    if (!pending || pending.exp < Date.now()) return back('error', 'state');
    if (req.query.error) return back('error', String(req.query.error).slice(0, 40));
    const code = String(req.query.code || '');
    if (!code) return back('error', 'no_code');

    const s = await loadSnapshot();
    const { clientId, clientSecret } = credentials(s);
    const tokens = await tokenRequest({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: pending.redirectUri, grant_type: 'authorization_code' }).catch(
      () => ({ error: 'network' }) as TokenResponse
    );
    if (tokens.error) return back('error', tokens.error);
    if (!tokens.refresh_token) return back('error', 'no_refresh_token');
    const granted = String((tokens as { scope?: string }).scope || '');
    if (granted && !granted.includes('webmasters')) return back('error', 'scope_denied');

    const accountEmail = emailFromIdToken(tokens.id_token);
    accessCache = null;
    await updateSnapshot((snap) => {
      snap.google.connected = true;
      snap.google.oauthRefreshToken = encryptSecret(tokens.refresh_token!);
      snap.google.accountEmail = accountEmail;
      snap.google.lastSyncAt = new Date().toISOString();
    });
    void audit(req, { action: 'seo.google_connect', target: accountEmail, userId: pending.userId, userEmail: pending.userEmail });
    back('connected');
  });

  router.get('/sites', canSeo, async (_req, res) => {
    const data = await googleFetch<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>('https://www.googleapis.com/webmasters/v3/sites');
    res.json((data.siteEntry || []).filter((e) => e.permissionLevel !== 'siteUnverifiedUser'));
  });

  router.get('/performance', canSeo, async (req, res) => {
    const s = await loadSnapshot();
    const site = s.google.searchConsoleProperty;
    if (!site) throw new HttpError(400, 'Sélectionnez une propriété Search Console');
    const days = Math.min(Number(req.query.days) || 28, 480);
    const end = new Date(Date.now() - 2 * 86400000);
    const start = new Date(end.getTime() - days * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
    type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
    const query = (dimensions: string[], rowLimit: number) =>
      googleFetch<{ rows?: Row[] }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions, rowLimit }),
      });
    const [byDate, byQuery, byPage] = await Promise.all([query(['date'], 500), query(['query'], 250), query(['page'], 250)]);
    const rows = byDate.rows || [];
    const totals = rows.reduce(
      (a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }),
      { clicks: 0, impressions: 0 }
    );
    await updateSnapshot((snap) => {
      snap.google.lastSyncAt = new Date().toISOString();
    });
    res.json({
      range: { start: fmt(start), end: fmt(end) },
      totals: {
        ...totals,
        ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
        position: rows.length ? rows.reduce((a, r) => a + r.position, 0) / rows.length : 0,
      },
      timeseries: rows.map((r) => ({ date: r.keys![0], clicks: r.clicks, impressions: r.impressions })),
      queries: (byQuery.rows || []).map((r) => ({ query: r.keys![0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
      pages: (byPage.rows || []).map((r) => ({ page: r.keys![0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    });
  });

  router.post('/disconnect', canManage, async (_req, res) => {
    accessCache = null;
    const s = await loadSnapshot();
    const refresh = refreshToken(s);
    if (refresh) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST', signal: AbortSignal.timeout(8_000) }).catch(() => undefined);
    }
    await updateSnapshot((snap) => {
      snap.google.connected = false;
      delete snap.google.oauthRefreshToken;
      delete snap.google.accountEmail;
    });
    res.json({ ok: true });
  });

  return router;
}
