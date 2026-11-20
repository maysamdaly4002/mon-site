import http from 'node:http';
import pg from 'pg';
import { LmsError } from '../core/errors';
import { verifyToken } from '../core/auth';
import { LmsService } from '../core/services';
import { postgresRepository } from '../adapters/postgres/repository';
import { routes } from './routes';

/**
 * API REST autonome (base relationnelle + authentification) : node:http, sans framework.
 * Variables : DATABASE_URL, LMS_JWT_SECRET (≥ 32 car.), PORT (3000).
 * Les routes sont celles de src/routes.ts, préfixées par /api ; documentation : docs/openapi.yaml.
 */
const secret = process.env.LMS_JWT_SECRET ?? '';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');
if (secret.length < 32) throw new Error('LMS_JWT_SECRET manquant ou trop court (32 caractères minimum)');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PGPOOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
});
// Une connexion inactive coupée par la base (redémarrage, Neon qui s'endort) ne doit pas faire tomber le processus.
pool.on('error', (e) => console.error('[pg] connexion inactive perdue :', e.message));
const lms = new LmsService(postgresRepository(pool), {
  jwtSecret: secret,
  branding: () => ({ organisation: process.env.LMS_ORGANISATION, signataire: process.env.LMS_SIGNATORY, verifyBase: process.env.LMS_VERIFY_URL }),
});

const STATUS: Record<LmsError['code'], number> = { validation: 400, forbidden: 403, not_found: 404, conflict: 409, unauthenticated: 401 };
const HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-site', 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
const send = (res: http.ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { ...HEADERS, 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const fail = (res: http.ServerResponse, status: number, code: string, message: string, details?: unknown) => send(res, status, { error: { code, message, details } });

async function readJson(req: http.IncomingMessage, max = 1_000_000): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > max) throw new LmsError('validation', 'Requête trop volumineuse'); chunks.push(c as Buffer); }
  if (!chunks.length) return {};
  try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); return v && typeof v === 'object' ? v : {}; } catch { throw new LmsError('validation', 'JSON invalide'); }
}

/** Anti-force-brute minimal : 8 tentatives de connexion / minute / (IP + e-mail). */
const tries = new Map<string, { n: number; reset: number }>();
const limited = (key: string) => {
  const now = Date.now();
  if (tries.size > 5000) for (const [k, v] of tries) if (v.reset < now) tries.delete(k); // pas de croissance sans limite
  const t = tries.get(key); if (!t || t.reset < now) { tries.set(key, { n: 1, reset: now + 60_000 }); return false; } return ++t.n > 8;
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/health') { await pool.query('SELECT 1'); return send(res, 200, { ok: true }); } // 500 si la base ne répond pas : l'orchestrateur redémarre ou retire l'instance
    if (!url.pathname.startsWith('/api/')) return fail(res, 404, 'not_found', 'Route inconnue');
    const path = url.pathname.slice(4);
    const body = req.method === 'POST' ? await readJson(req) : {};
    const query = Object.fromEntries(url.searchParams);

    if (req.method === 'POST' && path === '/auth/login') {
      if (limited(`${req.socket.remoteAddress}|${String(body.email).toLowerCase()}`)) return fail(res, 429, 'rate_limited', 'Trop de tentatives, réessayez dans une minute');
      try { const { token, actor } = await lms.login(String(body.email ?? ''), String(body.password ?? '')); return send(res, 200, { token, actor }); }
      catch (e) { if (e instanceof LmsError && e.code === 'forbidden') return fail(res, 401, 'unauthenticated', e.message); throw e; }
    }
    const route = routes.find((r) => r.method === req.method && r.path === path);
    if (!route) return fail(res, 404, 'not_found', 'Route inconnue');
    if (route.public) return send(res, 200, await route.run(lms, { id: 'public', nom: 'Public', role: 'auditeur' }, { ...query, ...body }));
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!bearer) return fail(res, 401, 'unauthenticated', 'Authentification requise');
    let actor; try { actor = verifyToken(bearer, secret); } catch { return fail(res, 401, 'unauthenticated', 'Session invalide ou expirée'); }

    const out: any = await route.run(lms, actor, { ...query, ...body });
    if (route.pdf) return send(res, 200, Buffer.from(out.base64, 'base64'), 'application/pdf');
    return send(res, 200, out);
  } catch (e) {
    if (e instanceof LmsError) return fail(res, STATUS[e.code], e.code, e.message, e.details);
    console.error(e);
    return fail(res, 500, 'internal', 'Erreur interne');
  }
});

// Délais serveur : protège contre les connexions lentes (slowloris) et les requêtes qui ne finissent jamais.
server.requestTimeout = 30_000; server.headersTimeout = 15_000; server.keepAliveTimeout = 65_000;

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`API LMS sur :${port}`));

/** Arrêt propre (SIGTERM d'un conteneur) : on cesse d'accepter, on laisse finir les requêtes en cours, on ferme la base. */
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return; stopping = true;
  console.log(`${signal} reçu : arrêt en cours…`);
  const force = setTimeout(() => { console.error('Arrêt forcé après 10 s'); process.exit(1); }, 10_000); force.unref();
  server.close(async () => { await pool.end().catch(() => {}); process.exit(0); });
  server.closeIdleConnections();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
