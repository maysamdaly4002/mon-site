import http from 'node:http';
import pg from 'pg';
import { ErpError } from '../core/errors';
import { verifyToken } from '../core/auth';
import { ErpService } from '../core/services';
import { postgresRepository } from '../adapters/postgres/repository';
import { routes } from './routes';

/**
 * API REST autonome (livrable « base relationnelle + authentification ») : node:http, sans framework.
 * Variables : DATABASE_URL, ERP_JWT_SECRET (≥ 32 car.), PORT (3000).
 * Les routes sont celles de src/routes.ts, préfixées par /api ; documentation : docs/openapi.yaml.
 */
const secret = process.env.ERP_JWT_SECRET ?? '';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');
if (secret.length < 32) throw new Error('ERP_JWT_SECRET manquant ou trop court (32 caractères minimum)');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const erp = new ErpService(postgresRepository(pool), { jwtSecret: secret });

const STATUS: Record<ErpError['code'], number> = { validation: 400, forbidden: 403, not_found: 404, conflict: 409 };
const HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'" };
const send = (res: http.ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { ...HEADERS, 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const fail = (res: http.ServerResponse, status: number, code: string, message: string, details?: unknown) => send(res, status, { error: { code, message, details } });

async function readJson(req: http.IncomingMessage, max = 3_000_000): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > max) throw new ErpError('validation', 'Requête trop volumineuse'); chunks.push(c as Buffer); }
  if (!chunks.length) return {};
  try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); return v && typeof v === 'object' ? v : {}; } catch { throw new ErpError('validation', 'JSON invalide'); }
}

/** Anti-force-brute minimal : 8 tentatives de connexion / minute / (IP + e-mail). */
const tries = new Map<string, { n: number; reset: number }>();
const limited = (key: string) => { const now = Date.now(); const t = tries.get(key); if (!t || t.reset < now) { tries.set(key, { n: 1, reset: now + 60_000 }); return false; } return ++t.n > 8; };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    if (!url.pathname.startsWith('/api/')) return fail(res, 404, 'not_found', 'Route inconnue');
    const path = url.pathname.slice(4);
    const body = req.method === 'POST' ? await readJson(req) : {};
    const query = Object.fromEntries(url.searchParams);

    if (req.method === 'POST' && path === '/auth/login') {
      if (limited(`${req.socket.remoteAddress}|${String(body.email).toLowerCase()}`)) return fail(res, 429, 'rate_limited', 'Trop de tentatives, réessayez dans une minute');
      try { const { token, actor } = await erp.login(String(body.email ?? ''), String(body.password ?? '')); return send(res, 200, { token, actor }); }
      catch (e) { if (e instanceof ErpError && e.code === 'forbidden') return fail(res, 401, 'unauthenticated', e.message); throw e; }
    }
    const route = routes.find((r) => r.method === req.method && r.path === path);
    if (!route) return fail(res, 404, 'not_found', 'Route inconnue');
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!bearer) return fail(res, 401, 'unauthenticated', 'Authentification requise');
    let actor; try { actor = verifyToken(bearer, secret); } catch { return fail(res, 401, 'unauthenticated', 'Session invalide ou expirée'); }

    const out: any = await route.run(erp, actor, { ...query, ...body });
    if (route.pdf) return send(res, 200, Buffer.from(out.base64, 'base64'), 'application/pdf');
    return send(res, 200, out);
  } catch (e) {
    if (e instanceof ErpError) return fail(res, STATUS[e.code], e.code, e.message, e.details);
    console.error(e);
    return fail(res, 500, 'internal', 'Erreur interne');
  }
});

// Alertes : balayage toutes les heures (idempotent : les doublons sont évités par la table alertes_envoyees).
setInterval(() => erp.runAlerts().then((r) => r.mails && console.log('[alertes]', r)).catch((e) => console.error('[alertes]', e)), 3_600_000).unref();
server.listen(Number(process.env.PORT ?? 3000), () => console.log(`API ERP sur :${process.env.PORT ?? 3000}`));
