/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import type { CmsPage, CmsSnapshot, PageContentSource } from './types';
import { createDefaultMenus, createDefaultSeoGlobal, createDefaultSystemSettings, createDefaultWidgetAreas, withDefaults } from './defaults';
import { createDefaultRoles, isPermission, SUPERADMIN_ROLE } from './permissions';
import { migrateContentToBlocks } from './contentMigration';

/** Publie les pages/articles planifiés dont la date est passée. */
export function applyScheduledPublishing(snapshot: CmsSnapshot): boolean {
  const now = Date.now();
  let changed = false;

  for (const page of snapshot.pages) {
    if (page.status === 'scheduled' && page.scheduledAt) {
      if (new Date(page.scheduledAt).getTime() <= now) {
        page.status = 'published';
        page.publishedAt = new Date().toISOString();
        changed = true;
      }
    }
  }

  for (const post of snapshot.posts) {
    if (post.status === 'scheduled' && post.scheduledAt) {
      if (new Date(post.scheduledAt).getTime() <= now) {
        post.status = 'published';
        post.publishedAt = new Date().toISOString();
        changed = true;
      }
    } else if (post.status === 'draft' && post.publishedAt) {
      const pub = new Date(post.publishedAt).getTime();
      if (pub <= now && pub > 0) {
        post.status = 'published';
        changed = true;
      }
    }
  }

  return changed;
}

export function migrateSnapshot(snapshot: CmsSnapshot): void {
  if (!snapshot.settings.seo) snapshot.settings.seo = createDefaultSeoGlobal();
  if (!snapshot.floatingButtons) snapshot.floatingButtons = [];
  snapshot.system = withDefaults(createDefaultSystemSettings(), snapshot.system);
  if (!Array.isArray(snapshot.roles) || !snapshot.roles.length) snapshot.roles = createDefaultRoles();
  const superRole = createDefaultRoles()[0];
  snapshot.roles = [superRole, ...snapshot.roles.filter((r) => r.id !== SUPERADMIN_ROLE)];
  for (const r of snapshot.roles) r.permissions = r.permissions.filter(isPermission);
  for (const u of snapshot.users) {
    u.status ??= 'active';
    if (!snapshot.roles.some((r) => r.id === u.role)) u.role = 'viewer';
  }
  for (const page of snapshot.pages) {
    const p = page as CmsPage & { contentSource?: PageContentSource };
    if (!p.contentSource) {
      p.contentSource =
        page.path === '/mentions-legales/' ||
        page.path === '/politique-de-confidentialite/' ||
        page.path === '/cookies/'
          ? 'cms'
          : 'react';
    }
  }
  migrateContentToBlocks(snapshot);
  if (!Array.isArray(snapshot.widgetAreas) || !snapshot.widgetAreas.length) {
    snapshot.widgetAreas = createDefaultWidgetAreas();
  }
  if (!Array.isArray(snapshot.blockPatterns)) snapshot.blockPatterns = [];
  const defaultMenus = createDefaultMenus();
  for (const dm of defaultMenus) {
    if (!snapshot.menus.some((m) => m.id === dm.id)) snapshot.menus.push(dm);
  }
}
