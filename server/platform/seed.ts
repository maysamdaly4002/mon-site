/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import crypto from 'crypto';
import { count, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { forumCategories, forumPosts, forumTopics, mpSettings, platformUsers } from '../db/schema';
import { syncOfficialMarketplace } from '../marketplace/syncOfficial';
import { hashPassword } from './passwords';

const CATEGORIES = [
  { slug: 'general', name: 'Général', description: 'Discussions libres autour de Snapify', icon: 'message-circle', position: 0 },
  { slug: 'themes', name: 'Thèmes', description: 'Apparence, personnalisation, CSS', icon: 'palette', position: 1 },
  { slug: 'modules', name: 'Modules', description: 'Extensions et intégrations', icon: 'puzzle', position: 2 },
  { slug: 'aide', name: 'Aide', description: 'Questions et dépannage', icon: 'life-buoy', position: 3 },
  { slug: 'annonces', name: 'Annonces', description: 'Nouveautés officielles Snapify', icon: 'megaphone', position: 4 },
];

export async function seedPlatform(): Promise<void> {
  const [catCount] = await db.select({ n: count() }).from(forumCategories);
  if ((catCount?.n || 0) === 0) {
    for (const c of CATEGORIES) {
      await db.insert(forumCategories).values({ id: crypto.randomUUID(), ...c });
    }
  }

  const [settingsCount] = await db.select({ n: count() }).from(mpSettings);
  if ((settingsCount?.n || 0) === 0) {
    await db.insert(mpSettings).values([
      { key: 'commissionBps', value: Number(process.env.MARKETPLACE_COMMISSION_BPS) || 3000 },
      { key: 'developerFeeMillimes', value: Number(process.env.DEVELOPER_FEE_MILLIMES) || 100_000 },
      { key: 'bankFallback', value: '' },
    ]);
  }

  const adminEmail = (process.env.PLATFORM_ADMIN_EMAIL || 'admin@snapify.tn').toLowerCase();
  const adminPass = process.env.PLATFORM_ADMIN_PASSWORD || 'SnapifyAdmin1';
  const existing = await db.select().from(platformUsers).where(eq(platformUsers.email, adminEmail)).limit(1);
  let adminId = existing[0]?.id;
  if (!existing.length) {
    const { hash, salt } = hashPassword(adminPass);
    adminId = crypto.randomUUID();
    await db.insert(platformUsers).values({
      id: adminId,
      email: adminEmail,
      displayName: 'Snapify Admin',
      passwordHash: hash,
      salt,
      role: 'admin',
    });
    console.log(`[platform] admin créé : ${adminEmail}`);
  }

  // Catalogue officiel : vrais modules/thèmes depuis marketplace/catalog.json (jamais de mocks)
  await syncOfficialMarketplace();

  // Welcome topic
  const [topicCount] = await db.select({ n: count() }).from(forumTopics);
  if ((topicCount?.n || 0) === 0 && adminId) {
    const [cat] = await db.select().from(forumCategories).where(eq(forumCategories.slug, 'annonces')).limit(1);
    if (cat) {
      const topicId = crypto.randomUUID();
      await db.insert(forumTopics).values({
        id: topicId,
        categoryId: cat.id,
        authorId: adminId,
        title: 'Bienvenue sur la communauté Snapify',
        slug: 'bienvenue',
        pinned: true,
      });
      await db.insert(forumPosts).values({
        id: crypto.randomUUID(),
        topicId,
        authorId: adminId,
        body: '<p>Bienvenue sur le forum des passionnés de Snapify ! Posez vos questions, partagez vos thèmes et modules, et aidez la communauté.</p>',
      });
    }
  }
}
