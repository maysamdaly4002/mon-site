/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { platformSessions, platformUsers } from '../db/schema';
import { HttpError } from '../http';
import { clientIp } from '../security/ip';
import { randomToken, sha256 } from '../security/secrets';
import { hashPassword, validatePlatformPassword, verifyPassword } from './passwords';
import { platformCookieDomainForHost } from './region';

export type PlatformUser = typeof platformUsers.$inferSelect;
export type PublicPlatformUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  role: PlatformUser['role'];
  createdAt: Date;
};

const COOKIE = 'sf_platform';
const SESSION_DAYS = 30;
const IDLE_MS = 14 * 24 * 3600_000;

declare global {
  namespace Express {
    interface Request {
      platformUser?: PlatformUser;
      platformSessionId?: string;
    }
  }
}

export function toPublicUser(u: PlatformUser): PublicPlatformUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    role: u.role,
    createdAt: u.createdAt,
  };
}

function cookieDomain(req: Request): string | undefined {
  const xf = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const host = (xf || String(req.headers.host || '')).split(':')[0].toLowerCase();
  return platformCookieDomainForHost(host) || process.env.PLATFORM_COOKIE_DOMAIN?.trim() || undefined;
}

function setSessionCookie(req: Request, res: Response, sessionId: string, expiresAt: Date) {
  res.cookie(COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: cookieDomain(req),
    path: '/',
    expires: expiresAt,
  });
}

function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE, { path: '/', domain: cookieDomain(req) });
}

function readCookie(req: Request): string | null {
  const header = req.headers.cookie || '';
  const match = header.match(/(?:^|;\s*)sf_platform=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function createPlatformUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<PlatformUser> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(422, 'Adresse e-mail invalide.');
  const err = validatePlatformPassword(input.password);
  if (err) throw new HttpError(422, err);
  const displayName = input.displayName.trim().slice(0, 80);
  if (displayName.length < 2) throw new HttpError(422, 'Le nom affiché est trop court.');

  const existing = await db.select({ id: platformUsers.id }).from(platformUsers).where(eq(platformUsers.email, email)).limit(1);
  if (existing.length) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail.');

  const { hash, salt } = hashPassword(input.password);
  const id = crypto.randomUUID();
  const [user] = await db
    .insert(platformUsers)
    .values({
      id,
      email,
      displayName,
      passwordHash: hash,
      salt,
      role: 'member',
    })
    .returning();
  return user;
}

export async function loginPlatformUser(
  req: Request,
  res: Response,
  email: string,
  password: string
): Promise<PlatformUser> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.select().from(platformUsers).where(eq(platformUsers.email, normalized)).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
  }
  const sessionId = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(platformSessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
    ip: clientIp(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
  });
  setSessionCookie(req, res, sessionId, expiresAt);
  return user;
}

export async function logoutPlatformUser(req: Request, res: Response) {
  const sid = readCookie(req);
  if (sid) {
    await db.update(platformSessions).set({ revokedAt: new Date() }).where(eq(platformSessions.id, sid));
  }
  clearSessionCookie(req, res);
}

export async function loadPlatformUser(req: Request): Promise<PlatformUser | null> {
  const sid = readCookie(req);
  if (!sid) return null;
  const [session] = await db
    .select()
    .from(platformSessions)
    .where(and(eq(platformSessions.id, sid), isNull(platformSessions.revokedAt), gt(platformSessions.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;
  if (Date.now() - session.lastSeenAt.getTime() > IDLE_MS) {
    await db.update(platformSessions).set({ revokedAt: new Date() }).where(eq(platformSessions.id, sid));
    return null;
  }
  const [user] = await db.select().from(platformUsers).where(eq(platformUsers.id, session.userId)).limit(1);
  if (!user) return null;
  await db.update(platformSessions).set({ lastSeenAt: new Date() }).where(eq(platformSessions.id, sid));
  req.platformSessionId = sid;
  return user;
}

export async function platformAuthOptional(req: Request, _res: Response, next: NextFunction) {
  try {
    req.platformUser = (await loadPlatformUser(req)) || undefined;
    next();
  } catch (e) {
    next(e);
  }
}

export async function requirePlatformUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await loadPlatformUser(req);
    if (!user) throw new HttpError(401, 'Connexion requise.');
    req.platformUser = user;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: PlatformUser['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const u = req.platformUser;
    if (!u) return next(new HttpError(401, 'Connexion requise.'));
    if (!roles.includes(u.role) && u.role !== 'admin') return next(new HttpError(403, 'Accès refusé.'));
    next();
  };
}

export async function createResetToken(userId: string): Promise<string> {
  const raw = randomToken(32);
  const { platformAuthTokens } = await import('../db/schema');
  await db.insert(platformAuthTokens).values({
    id: crypto.randomUUID(),
    userId,
    kind: 'reset',
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + 3600_000),
  });
  return raw;
}

export async function consumeResetToken(raw: string, newPassword: string): Promise<void> {
  const err = validatePlatformPassword(newPassword);
  if (err) throw new HttpError(422, err);
  const { platformAuthTokens } = await import('../db/schema');
  const hash = sha256(raw);
  const [tok] = await db
    .select()
    .from(platformAuthTokens)
    .where(and(eq(platformAuthTokens.tokenHash, hash), eq(platformAuthTokens.kind, 'reset'), isNull(platformAuthTokens.usedAt), gt(platformAuthTokens.expiresAt, new Date())))
    .limit(1);
  if (!tok) throw new HttpError(400, 'Lien de réinitialisation invalide ou expiré.');
  const { hash: passwordHash, salt } = hashPassword(newPassword);
  await db.update(platformUsers).set({ passwordHash, salt, updatedAt: new Date() }).where(eq(platformUsers.id, tok.userId));
  await db.update(platformAuthTokens).set({ usedAt: new Date() }).where(eq(platformAuthTokens.id, tok.id));
  await db.update(platformSessions).set({ revokedAt: new Date() }).where(eq(platformSessions.userId, tok.userId));
}
