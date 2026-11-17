/**
 * Snapify — fiches clients (demandes de site / licences)
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 */
import crypto from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { clientProfiles, platformUsers } from '../db/schema';
import type { LicenseOrder } from './licenseOrders';

export type ClientProfile = typeof clientProfiles.$inferSelect;

function id() {
  return crypto.randomUUID();
}

export function marketFromHost(host: string): 'tn' | 'fr' {
  const h = host.toLowerCase();
  if (h.includes('.fr') || h.endsWith('fr')) return 'fr';
  return 'tn';
}

/** Crée ou met à jour la fiche client dès qu’une demande licence est déposée. */
export async function ensureClientFromLicenseOrder(
  order: LicenseOrder,
  opts: { market?: 'tn' | 'fr'; country?: string } = {}
): Promise<ClientProfile> {
  const email = order.email.trim().toLowerCase();
  const market = opts.market || 'tn';
  const country = (opts.country || (market === 'fr' ? 'FR' : 'TN')).toUpperCase().slice(0, 2);

  const [existing] = await db.select().from(clientProfiles).where(eq(clientProfiles.email, email)).limit(1);
  const orderIds = existing?.licenseOrderIds?.includes(order.id)
    ? existing.licenseOrderIds
    : [...(existing?.licenseOrderIds || []), order.id];

  // Lier un compte plateforme existant (même e-mail)
  let platformUserId = existing?.platformUserId || null;
  if (!platformUserId) {
    const [u] = await db.select({ id: platformUsers.id }).from(platformUsers).where(eq(platformUsers.email, email)).limit(1);
    if (u) platformUserId = u.id;
  }

  const nextStatus =
    order.status === 'paid' ? ('active' as const) : existing?.status === 'active' ? ('active' as const) : ('lead' as const);

  if (existing) {
    const [updated] = await db
      .update(clientProfiles)
      .set({
        name: order.name || existing.name,
        phone: order.details?.phone || existing.phone,
        company: order.details?.company || existing.company,
        domain: order.domain || existing.domain,
        market: existing.market || market,
        country: country || existing.country,
        status: nextStatus,
        licenseOrderIds: orderIds,
        platformUserId,
        updatedAt: new Date(),
      })
      .where(eq(clientProfiles.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(clientProfiles)
    .values({
      id: id(),
      platformUserId,
      email,
      name: order.name,
      phone: order.details?.phone || '',
      company: order.details?.company || '',
      domain: order.domain,
      market,
      country,
      status: nextStatus,
      licenseOrderIds: orderIds,
    })
    .returning();
  return created;
}

/** Lie la fiche à un user plateforme après login/register. */
export async function linkClientProfileToUser(email: string, userId: string): Promise<ClientProfile | null> {
  const e = email.trim().toLowerCase();
  const [row] = await db.select().from(clientProfiles).where(eq(clientProfiles.email, e)).limit(1);
  if (!row) return null;
  if (row.platformUserId === userId) return row;
  const [updated] = await db
    .update(clientProfiles)
    .set({ platformUserId: userId, updatedAt: new Date() })
    .where(eq(clientProfiles.id, row.id))
    .returning();
  return updated;
}

export async function getClientByUserId(userId: string): Promise<ClientProfile | null> {
  const [byUser] = await db.select().from(clientProfiles).where(eq(clientProfiles.platformUserId, userId)).limit(1);
  if (byUser) return byUser;
  const [u] = await db.select().from(platformUsers).where(eq(platformUsers.id, userId)).limit(1);
  if (!u) return null;
  return linkClientProfileToUser(u.email, userId);
}

export async function getClientByEmail(email: string): Promise<ClientProfile | null> {
  const [row] = await db.select().from(clientProfiles).where(eq(clientProfiles.email, email.trim().toLowerCase())).limit(1);
  return row || null;
}

export async function listClientProfiles(opts: { status?: string; q?: string } = {}) {
  let items = await db.select().from(clientProfiles).orderBy(desc(clientProfiles.createdAt));
  if (opts.status && opts.status !== 'all') items = items.filter((r) => r.status === opts.status);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    items = items.filter(
      (r) =>
        r.email.includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q)
    );
  }
  return items;
}

export async function updateClientProfile(
  id: string,
  patch: Partial<Pick<ClientProfile, 'name' | 'phone' | 'company' | 'domain' | 'status' | 'notes' | 'market' | 'country'>>
) {
  const [updated] = await db
    .update(clientProfiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clientProfiles.id, id))
    .returning();
  return updated || null;
}
