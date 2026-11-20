import crypto from 'node:crypto';
import { LmsError } from './errors';
import type { Actor, Role } from './types';

/** Mots de passe : scrypt + sel aléatoire. Jetons : HS256 (JWT) signés avec LMS_JWT_SECRET, durée limitée. */
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const a = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
export interface Claims { sub: string; nom: string; role: Role; exp: number }
export function signToken(a: Actor, secret: string, ttlSec = 8 * 3600, now = Date.now()): string {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ sub: a.id, nom: a.nom, role: a.role, exp: Math.floor(now / 1000) + ttlSec } satisfies Claims));
  return `${head}.${body}.${b64(crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest())}`;
}
export function verifyToken(token: string, secret: string, now = Date.now()): Actor {
  const bad = () => new LmsError('forbidden', 'Session invalide ou expirée');
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw bad();
  const good = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const given = Buffer.from(s, 'base64url');
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) throw bad();
  const c = JSON.parse(Buffer.from(p, 'base64url').toString()) as Claims;
  if (!(c.exp * 1000 > now)) throw bad();
  return { id: c.sub, nom: c.nom, role: c.role };
}
