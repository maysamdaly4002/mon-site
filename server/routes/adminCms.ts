/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { loadSnapshot, updateSnapshot, getDataPaths } from '../cms/store';
import { assertPerm, hasPerm, requireAuth, requirePerm, type AuthedRequest } from '../middleware/adminAuth';
import { analyzePageSeo, analyzePostSeo } from '../cms/seoAnalyzer';
import { saveRevision, listRevisions, getRevision } from '../cms/revisions';
import { summarizeAnalytics } from '../cms/analyticsStore';
import { asyncRouter, HttpError } from '../http';
import type {
  BlockPattern,
  BlogPost,
  CmsBlock,
  CmsPage,
  CmsSnapshot,
  MenuItem,
  RedirectRule,
  SystemSettings,
  WidgetArea,
  WidgetInstance,
} from '../cms/types';
import { defaultSeoForPath } from '../cms/defaults';
import { publicUser } from '../security/accounts';
import { smtpSource } from '../mail';
import { googleOAuthConfigured } from './googleOAuth';

/** Types MIME acceptés selon les paramètres « Médias ». */
function allowedMime(u: SystemSettings['uploads'], mime: string): boolean {
  if (u.allowImages && /^image\/(png|jpe?g|webp|gif|avif)$/.test(mime)) return true;
  if (u.allowSvg && mime === 'image/svg+xml') return true;
  if (u.allowVideo && /^video\/(mp4|webm)$/.test(mime)) return true;
  return u.allowPdf && mime === 'application/pdf';
}

function allowedLabel(u: SystemSettings['uploads']): string {
  const kinds = [u.allowImages && 'images', u.allowSvg && 'SVG', u.allowVideo && 'vidéos MP4/WebM', u.allowPdf && 'PDF'].filter(Boolean);
  return kinds.length ? kinds.join(', ') : 'aucun format autorisé';
}

/** Sans droit de publication, seuls les brouillons sont modifiables (et ils le restent). */
function assertCanTouchStatus(req: AuthedRequest, perm: 'pages.publish' | 'posts.publish', before: { status: string }, nextStatus?: string) {
  if (hasPerm(req, perm)) return;
  if (before.status !== 'draft') throw new HttpError(403, 'Ce contenu est en ligne ou planifié : seule une personne autorisée à publier peut le modifier', 'FORBIDDEN');
  if (nextStatus && nextStatus !== 'draft') throw new HttpError(403, 'Vous n’êtes pas autorisé à publier : enregistrez en brouillon', 'FORBIDDEN');
}

function pick<T extends object>(source: unknown, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  if (!source || typeof source !== 'object') return out;
  for (const k of keys) {
    if (k in (source as object)) out[k] = (source as T)[k];
  }
  return out;
}

export function normalizePath(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/-]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/-{2,}/g, '-');
  const withSlashes = `/${cleaned.replace(/^\/+|\/+$/g, '')}/`;
  return withSlashes === '//' ? '/' : withSlashes;
}

export function slugify(input: string): string {
  return normalizePath(input).replace(/^\/|\/$/g, '').replace(/\//g, '-');
}

const PROTECTED_MENU_IDS = new Set(['primary', 'mobile', 'footer']);

function normalizeMenuId(raw: string): string {
  const id = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!id) throw new HttpError(400, 'Identifiant de menu invalide');
  return id;
}

const CORE_WIDGET_KINDS = new Set(['text', 'html', 'menu', 'recent_posts', 'search', 'module']);

function sanitizeWidgetInstance(raw: unknown): WidgetInstance {
  const w = raw as WidgetInstance;
  if (!w?.id?.trim()) throw new HttpError(400, 'Chaque widget doit avoir un identifiant');
  if (!CORE_WIDGET_KINDS.has(String(w.kind))) throw new HttpError(400, `Type de widget inconnu : ${String(w.kind)}`);
  return {
    id: w.id.trim(),
    kind: w.kind,
    title: String(w.title ?? '').trim(),
    data: w.data && typeof w.data === 'object' && !Array.isArray(w.data) ? (w.data as Record<string, unknown>) : {},
  };
}

function sanitizeWidgetAreas(raw: unknown): WidgetArea[] {
  if (!Array.isArray(raw)) throw new HttpError(400, 'Liste de zones invalide');
  return raw.map((area) => {
    const a = area as WidgetArea;
    if (!a?.id?.trim() || !a.label?.trim()) throw new HttpError(400, 'Chaque zone doit avoir un identifiant et un libellé');
    return {
      id: a.id.trim(),
      label: a.label.trim(),
      description: a.description?.trim() || undefined,
      widgets: Array.isArray(a.widgets) ? a.widgets.map(sanitizeWidgetInstance) : [],
    };
  });
}

function sanitizeBlockPatterns(raw: unknown): BlockPattern[] {
  if (!Array.isArray(raw)) throw new HttpError(400, 'Liste de modèles invalide');
  return raw.map((p) => {
    const pat = p as BlockPattern;
    if (!pat?.id?.trim() || !pat.name?.trim()) throw new HttpError(400, 'Chaque modèle doit avoir un identifiant et un nom');
    if (!Array.isArray(pat.blocks)) throw new HttpError(400, 'Modèle de blocs invalide');
    return {
      id: pat.id.trim(),
      name: pat.name.trim(),
      description: pat.description?.trim() || undefined,
      blocks: pat.blocks as CmsBlock[],
      createdAt: pat.createdAt || new Date().toISOString(),
    };
  });
}

function sanitizeMenuItems(items: unknown, depth = 0): MenuItem[] {
  if (!Array.isArray(items)) throw new HttpError(400, 'Menu invalide');
  return items.map((raw) => {
    const it = raw as MenuItem;
    if (!it.label?.trim() || !it.path?.trim()) throw new HttpError(400, 'Chaque lien doit avoir un libellé et une destination');
    return {
      id: it.id || crypto.randomUUID(),
      label: it.label.trim(),
      path: it.path.trim(),
      openInNewTab: !!it.openInNewTab,
      highlight: !!it.highlight,
      children: depth === 0 && it.children?.length ? sanitizeMenuItems(it.children, 1) : undefined,
    };
  });
}

function sanitizeSnapshotForClient(s: CmsSnapshot, req: AuthedRequest) {
  const { oauthRefreshToken, oauthClientSecretEnc: _secret, ...google } = s.google;
  return {
    ...s,
    google: { ...google, hasRefreshToken: !!oauthRefreshToken },
    users: hasPerm(req, 'users.view') ? s.users.map(publicUser) : s.users.filter((u) => u.id === req.admin!.sub).map(publicUser),
    system: undefined,
    formSubmissions: undefined,
    subscribers: undefined,
  };
}

export function createAdminCmsRouter() {
  const router = asyncRouter();

  /* ---------- Lecture globale & tableau de bord ---------- */

  router.get('/snapshot', requireAuth(), async (req: AuthedRequest, res) => {
    res.json(sanitizeSnapshotForClient(await loadSnapshot(), req));
  });

  router.get('/dashboard', requireAuth(), async (req: AuthedRequest, res) => {
    const s = await loadSnapshot();
    const canForms = hasPerm(req, 'forms.view');
    const analytics = hasPerm(req, 'analytics.view') ? await summarizeAnalytics(30, new URL(s.settings.publicUrl).hostname) : null;
    const seoScores = [
      ...s.pages.filter((p) => p.status === 'published').map((p) => analyzePageSeo(p).score),
      ...s.posts.filter((p) => p.status === 'published').map((p) => analyzePostSeo(p).score),
    ];
    res.json({
      analytics,
      counts: {
        pages: s.pages.length,
        publishedPages: s.pages.filter((p) => p.status === 'published').length,
        posts: s.posts.length,
        draftPosts: s.posts.filter((p) => p.status === 'draft').length,
        unreadSubmissions: canForms ? s.formSubmissions.filter((x) => !x.read).length : null,
        submissions: canForms ? s.formSubmissions.length : null,
        subscribers: hasPerm(req, 'newsletter.manage') ? s.subscribers.filter((x) => x.status === 'active').length : null,
        media: s.media.length,
      },
      seoAverage: seoScores.length ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length) : 0,
      recentSubmissions: canForms ? s.formSubmissions.slice(0, 5) : null,
      maintenance: s.settings.maintenance.enabled,
      health: hasPerm(req, 'settings.manage', 'seo.edit', 'modules.manage')
        ? {
            smtp: smtpSource(s) !== 'none',
            gemini: !!process.env.GEMINI_API_KEY,
            google: s.google.connected,
            googleOAuthConfigured: googleOAuthConfigured(s),
          }
        : null,
    });
  });

  /* ---------- Réglages ---------- */

  router.put('/general', requirePerm('site.general'), async (req, res) => {
    const patch = pick<CmsSnapshot['general']>(req.body, [
      'legalName', 'baseline', 'slogan', 'phone', 'phoneClean', 'contactEmail', 'slaHours', 'address', 'timezone', 'locale',
    ]);
    if (patch.phone && !patch.phoneClean) {
      const digits = patch.phone.replace(/\D/g, '');
      patch.phoneClean = patch.phone.trim().startsWith('+') ? `+${digits}` : digits.startsWith('00') ? `+${digits.slice(2)}` : `+33${digits.replace(/^0/, '')}`;
    }
    await updateSnapshot((s) => {
      s.general = { ...s.general, ...patch };
    });
    res.json({ ok: true });
  });

  router.put('/branding', requirePerm('appearance.customize'), async (req, res) => {
    const body = req.body as Partial<CmsSnapshot['branding']>;
    const patch = pick<CmsSnapshot['branding']>(body, ['siteName', 'tagline', 'logoUrl', 'logoDarkUrl', 'faviconUrl']);
    await updateSnapshot((s) => {
      s.branding = {
        ...s.branding,
        ...patch,
        colors: { ...s.branding.colors, ...(body.colors || {}) },
        fonts: { ...s.branding.fonts, ...(body.fonts || {}) },
      };
    });
    res.json({ ok: true });
  });

  router.put('/settings', requirePerm('site.maintenance', 'settings.manage'), async (req: AuthedRequest, res) => {
    const body = req.body as Partial<CmsSnapshot['settings']>;
    const patch = pick<CmsSnapshot['settings']>(body, [
      'publicUrl', 'cookieBannerEnabled', 'analyticsEnabled', 'robotsTxtExtra', 'sitemapAuto',
    ]);
    if (Object.keys(patch).length || body.seo) assertPerm(req, 'settings.manage');
    if (body.maintenance && !hasPerm(req, 'settings.manage')) assertPerm(req, 'site.maintenance');
    res.locals.audit = body.maintenance && !Object.keys(patch).length && !body.seo
      ? { action: 'site.maintenance', detail: { enabled: body.maintenance.enabled } }
      : undefined;
    if (patch.publicUrl) {
      try {
        new URL(patch.publicUrl);
      } catch {
        throw new HttpError(400, 'URL publique invalide');
      }
    }
    await updateSnapshot((s) => {
      s.settings = {
        ...s.settings,
        ...patch,
        maintenance: { ...s.settings.maintenance, ...(body.maintenance || {}) },
        seo: { ...s.settings.seo, ...(body.seo || {}) },
      };
    });
    res.json({ ok: true });
  });

  router.put('/seo-settings', requirePerm('seo.edit'), async (req, res) => {
    const patch = pick<CmsSnapshot['settings']['seo']>(req.body || {}, [
      'titleSeparator', 'titleSuffix', 'defaultOgImage', 'organizationName', 'organizationLogo', 'socialProfiles', 'googleVerification', 'bingVerification',
    ]);
    if (patch.socialProfiles && !Array.isArray(patch.socialProfiles)) throw new HttpError(400, 'Profils sociaux invalides');
    await updateSnapshot((s) => {
      s.settings.seo = { ...s.settings.seo, ...patch };
      if (typeof req.body?.robotsTxtExtra === 'string') s.settings.robotsTxtExtra = req.body.robotsTxtExtra.slice(0, 5000);
    });
    res.json({ ok: true });
  });

  router.put('/floating-buttons', requirePerm('engagement.edit'), async (req, res) => {
    const list = Array.isArray(req.body?.buttons) ? req.body.buttons : [];
    await updateSnapshot((s) => {
      s.floatingButtons = list.map((b: CmsSnapshot['floatingButtons'][number]) => ({
        id: b.id || crypto.randomUUID(),
        label: String(b.label || '').trim(),
        path: String(b.path || '').trim(),
        style: b.style || 'primary',
        enabled: !!b.enabled,
      }));
    });
    res.json({ ok: true });
  });

  router.put('/newsletter', requirePerm('newsletter.manage'), async (req, res) => {
    const patch = pick<CmsSnapshot['newsletter']>(req.body, ['enabled', 'provider', 'doubleOptIn', 'welcomeEmailSubject', 'listId']);
    await updateSnapshot((s) => {
      s.newsletter = { ...s.newsletter, ...patch };
    });
    res.json({ ok: true });
  });

  router.put('/google', requirePerm('seo.edit'), async (req, res) => {
    const patch = pick<CmsSnapshot['google']>(req.body, ['searchConsoleProperty', 'analyticsPropertyId']);
    await updateSnapshot((s) => {
      s.google = { ...s.google, ...patch };
    });
    res.json({ ok: true });
  });

  router.post('/menus', requirePerm('menus.edit'), async (req, res) => {
    const id = normalizeMenuId(String(req.body?.id || ''));
    const label = String(req.body?.label || '').trim();
    if (!label) throw new HttpError(400, 'Libellé du menu requis');
    await updateSnapshot((s) => {
      if (s.menus.some((m) => m.id === id)) throw new HttpError(409, 'Un menu porte déjà cet identifiant');
      s.menus.push({ id, label, items: [] });
    });
    res.status(201).json({ ok: true, id });
  });

  router.put('/menus/:menuId', requirePerm('menus.edit'), async (req, res) => {
    const menuId = req.params.menuId;
    const label = req.body?.label !== undefined ? String(req.body.label).trim() : undefined;
    const hasItems = req.body?.items !== undefined;
    if (hasItems) sanitizeMenuItems(req.body.items);
    await updateSnapshot((s) => {
      let menu = s.menus.find((m) => m.id === menuId);
      if (!menu) {
        if (!label) throw new HttpError(404, 'Menu introuvable');
        menu = { id: menuId, label, items: hasItems ? sanitizeMenuItems(req.body.items) : [] };
        s.menus.push(menu);
        return;
      }
      if (label) menu.label = label;
      if (hasItems) menu.items = sanitizeMenuItems(req.body.items);
    });
    res.json({ ok: true });
  });

  router.delete('/menus/:menuId', requirePerm('menus.edit'), async (req, res) => {
    const menuId = req.params.menuId;
    if (PROTECTED_MENU_IDS.has(menuId)) throw new HttpError(403, 'Ce menu système ne peut pas être supprimé');
    await updateSnapshot((s) => {
      const before = s.menus.length;
      s.menus = s.menus.filter((m) => m.id !== menuId);
      if (s.menus.length === before) throw new HttpError(404, 'Menu introuvable');
    });
    res.json({ ok: true });
  });

  router.put('/widget-areas', requirePerm('widgets.edit'), async (req, res) => {
    const areas = sanitizeWidgetAreas(req.body?.areas ?? req.body);
    await updateSnapshot((s) => {
      s.widgetAreas = areas;
    });
    res.json({ ok: true, areas });
  });

  router.put('/widget-areas/:areaId', requirePerm('widgets.edit'), async (req, res) => {
    const widgets = Array.isArray(req.body?.widgets) ? req.body.widgets.map(sanitizeWidgetInstance) : null;
    if (!widgets) throw new HttpError(400, 'Liste de widgets requise');
    await updateSnapshot((s) => {
      const area = s.widgetAreas.find((a) => a.id === req.params.areaId);
      if (!area) throw new HttpError(404, 'Zone de widgets introuvable');
      area.widgets = widgets;
    });
    res.json({ ok: true });
  });

  router.get('/block-patterns', requireAuth(), async (_req, res) => {
    const s = await loadSnapshot();
    res.json(s.blockPatterns);
  });

  router.put('/block-patterns', requirePerm('widgets.edit'), async (req, res) => {
    const patterns = sanitizeBlockPatterns(req.body?.patterns ?? req.body);
    await updateSnapshot((s) => {
      s.blockPatterns = patterns;
    });
    res.json({ ok: true, patterns });
  });

  router.post('/block-patterns', requirePerm('widgets.edit'), async (req, res) => {
    const body = req.body as Partial<BlockPattern>;
    if (!body.name?.trim()) throw new HttpError(400, 'Nom du modèle requis');
    if (!Array.isArray(body.blocks)) throw new HttpError(400, 'Blocs requis');
    const pattern: BlockPattern = {
      id: body.id?.trim() || crypto.randomUUID(),
      name: body.name.trim(),
      description: body.description?.trim(),
      blocks: body.blocks as CmsBlock[],
      createdAt: new Date().toISOString(),
    };
    await updateSnapshot((s) => {
      if (s.blockPatterns.some((p) => p.id === pattern.id)) throw new HttpError(409, 'Identifiant de modèle déjà utilisé');
      s.blockPatterns.unshift(pattern);
    });
    res.status(201).json(pattern);
  });

  router.delete('/block-patterns/:id', requirePerm('widgets.edit'), async (req, res) => {
    await updateSnapshot((s) => {
      const before = s.blockPatterns.length;
      s.blockPatterns = s.blockPatterns.filter((p) => p.id !== req.params.id);
      if (s.blockPatterns.length === before) throw new HttpError(404, 'Modèle introuvable');
    });
    res.json({ ok: true });
  });

  router.put('/redirects', requirePerm('seo.edit'), async (req, res) => {
    const list = (Array.isArray(req.body?.redirects) ? req.body.redirects : []) as RedirectRule[];
    const seen = new Set<string>();
    const redirects = list.map((r) => {
      const from = normalizePath(String(r.from || ''));
      const to = String(r.to || '').trim();
      if (!to) throw new HttpError(400, `Destination manquante pour ${from}`);
      if (seen.has(from)) throw new HttpError(400, `Redirection en double : ${from}`);
      if (from === normalizePath(to)) throw new HttpError(400, `Redirection en boucle : ${from}`);
      seen.add(from);
      return { from, to: to.startsWith('http') ? to : normalizePath(to), permanent: r.permanent !== false };
    });
    await updateSnapshot((s) => {
      s.redirects = redirects;
    });
    res.json({ ok: true });
  });

  /* ---------- Pages ---------- */

  router.get('/pages', requireAuth(), async (_req, res) => {
    const s = await loadSnapshot();
    res.json(s.pages.map((p) => ({ ...p, seoScore: analyzePageSeo(p).score })));
  });

  router.post('/pages', requirePerm('pages.edit'), async (req, res) => {
    const body = req.body as Partial<CmsPage>;
    if (!body.title?.trim()) throw new HttpError(400, 'Titre requis');
    const pagePath = normalizePath(body.path || body.title);
    const s = await loadSnapshot();
    if (s.pages.some((p) => p.path === pagePath)) throw new HttpError(409, `L'adresse ${pagePath} est déjà utilisée`);
    const t = new Date().toISOString();
    const template = body.template || 'default';
    const page: CmsPage = {
      id: crypto.randomUUID(),
      path: pagePath,
      title: body.title.trim(),
      status: 'draft',
      contentSource: 'cms',
      template,
      blocks: body.blocks || [],
      seo: body.seo || defaultSeoForPath(pagePath, body.title.trim()),
      ...(body.project
        ? { project: body.project }
        : template === 'project'
          ? { project: { client: '', location: '', sector: 'Industrie', solution: '', summary: '', image: '', results: [] } }
          : {}),
      createdAt: t,
      updatedAt: t,
    };
    await updateSnapshot((snap) => {
      snap.pages.push(page);
    });
    res.locals.audit = { target: page.title };
    res.status(201).json(page);
  });

  router.put('/pages/:id', requirePerm('pages.edit', 'seo.edit'), async (req: AuthedRequest, res) => {
    const id = req.params.id;
    const s = await loadSnapshot();
    const before = s.pages.find((p) => p.id === id);
    if (!before) throw new HttpError(404, 'Page introuvable');
    const body = req.body as Partial<CmsPage>;

    // Sans droit d'édition (ou sur un contenu en ligne sans droit de publication), seul le référencement est modifiable.
    const contentEditable = hasPerm(req, 'pages.edit') && (hasPerm(req, 'pages.publish') || before.status === 'draft');
    let patch: Partial<CmsPage>;
    if (contentEditable) {
      patch = pick<CmsPage>(body, ['title', 'path', 'status', 'scheduledAt', 'contentSource', 'template', 'blocks', 'seo', 'project']);
      const statusChange = patch.status !== undefined && patch.status !== before.status;
      const scheduleChange = !!patch.scheduledAt && patch.scheduledAt !== before.scheduledAt;
      if (statusChange || scheduleChange) assertCanTouchStatus(req, 'pages.publish', before, statusChange ? patch.status : 'scheduled');
    } else if (hasPerm(req, 'seo.edit')) {
      patch = { seo: body.seo };
    } else {
      assertCanTouchStatus(req, 'pages.publish', before);
      patch = {};
    }
    if (!patch.seo) delete patch.seo;

    if (patch.path) {
      patch.path = normalizePath(patch.path);
      if (s.pages.some((p) => p.id !== id && p.path === patch.path)) throw new HttpError(409, `L'adresse ${patch.path} est déjà utilisée`);
    }
    if (patch.status === 'scheduled' && !(patch.scheduledAt || before.scheduledAt)) {
      throw new HttpError(400, 'Indiquez une date de publication');
    }

    await saveRevision({ entityType: 'page', entityId: id, label: before.title, snapshot: before, authorEmail: req.admin?.email });
    const updated = await updateSnapshot((snap) => {
      const idx = snap.pages.findIndex((p) => p.id === id);
      const next = { ...snap.pages[idx], ...patch, updatedAt: new Date().toISOString() };
      if (next.status === 'published' && !next.publishedAt) next.publishedAt = next.updatedAt;
      snap.pages[idx] = next;
    });
    const page = updated.pages.find((p) => p.id === id)!;
    res.locals.audit = { target: page.title, detail: before.status !== page.status ? { status: { from: before.status, to: page.status } } : undefined };
    res.json({ ...page, seoScore: analyzePageSeo(page).score });
  });

  router.delete('/pages/:id', requirePerm('pages.delete'), async (req, res) => {
    let title = '';
    await updateSnapshot((s) => {
      const page = s.pages.find((p) => p.id === req.params.id);
      if (!page) throw new HttpError(404, 'Page introuvable');
      if (page.path === '/') throw new HttpError(400, "La page d'accueil ne peut pas être supprimée");
      title = page.title;
      s.pages = s.pages.filter((p) => p.id !== req.params.id);
    });
    res.locals.audit = { target: title };
    res.json({ ok: true });
  });

  router.get('/pages/:id/revisions', requireAuth(), async (req, res) => {
    const revs = await listRevisions('page', req.params.id);
    res.json(revs.map(({ snapshot, ...r }) => ({ ...r, title: snapshot.title })));
  });

  router.post('/pages/:id/revisions/:revId/restore', requirePerm('pages.edit'), async (req: AuthedRequest, res) => {
    const rev = await getRevision(req.params.revId);
    if (!rev || rev.entityType !== 'page' || rev.entityId !== req.params.id) throw new HttpError(404, 'Révision introuvable');
    const current = (await loadSnapshot()).pages.find((p) => p.id === req.params.id);
    if (current) assertCanTouchStatus(req, 'pages.publish', current, (rev.snapshot as CmsPage).status);
    res.locals.audit = { target: current?.title };
    if (current) await saveRevision({ entityType: 'page', entityId: current.id, label: current.title, snapshot: current, authorEmail: req.admin?.email });
    const updated = await updateSnapshot((s) => {
      const idx = s.pages.findIndex((p) => p.id === req.params.id);
      if (idx === -1) throw new HttpError(404, 'Page introuvable');
      s.pages[idx] = { ...(rev.snapshot as CmsPage), updatedAt: new Date().toISOString() };
    });
    res.json(updated.pages.find((p) => p.id === req.params.id));
  });

  /* ---------- Articles ---------- */

  router.get('/posts', requireAuth(), async (_req, res) => {
    const s = await loadSnapshot();
    res.json(s.posts.map((p) => ({ ...p, seoScore: analyzePostSeo(p).score })));
  });

  router.post('/posts', requirePerm('posts.edit'), async (req: AuthedRequest, res) => {
    const body = req.body as Partial<BlogPost>;
    const title = body.title?.trim() || 'Nouvel article';
    const s = await loadSnapshot();
    let slug = slugify(body.slug || title);
    let n = 2;
    while (s.posts.some((p) => p.slug === slug)) slug = `${slugify(body.slug || title)}-${n++}`;
    const t = new Date().toISOString();
    const post: BlogPost = {
      id: crypto.randomUUID(),
      slug,
      title,
      excerpt: body.excerpt || '',
      coverImage: body.coverImage,
      blocks: body.blocks || [],
      seo: { ...defaultSeoForPath(`/blog/${slug}/`, title), slug, schemaType: 'Article' },
      status: 'draft',
      author: req.admin?.name,
      tags: body.tags || [],
      createdAt: t,
      updatedAt: t,
    };
    await updateSnapshot((snap) => {
      snap.posts.unshift(post);
    });
    res.locals.audit = { target: post.title };
    res.status(201).json(post);
  });

  router.put('/posts/:id', requirePerm('posts.edit', 'seo.edit'), async (req: AuthedRequest, res) => {
    const id = req.params.id;
    const s = await loadSnapshot();
    const before = s.posts.find((p) => p.id === id);
    if (!before) throw new HttpError(404, 'Article introuvable');
    const body = req.body as Partial<BlogPost>;
    const contentEditable = hasPerm(req, 'posts.edit') && (hasPerm(req, 'posts.publish') || before.status === 'draft');
    let patch: Partial<BlogPost>;
    if (contentEditable) {
      patch = pick<BlogPost>(body, ['title', 'slug', 'excerpt', 'coverImage', 'blocks', 'seo', 'status', 'publishedAt', 'scheduledAt', 'tags', 'author']);
      const statusChange = patch.status !== undefined && patch.status !== before.status;
      const dateChange = !!patch.publishedAt && patch.publishedAt !== before.publishedAt;
      const scheduleChange = !!patch.scheduledAt && patch.scheduledAt !== before.scheduledAt;
      if (statusChange || dateChange || scheduleChange) {
        assertCanTouchStatus(req, 'posts.publish', before, statusChange ? patch.status : scheduleChange ? 'scheduled' : 'published');
      }
    } else if (hasPerm(req, 'seo.edit')) {
      patch = { seo: body.seo };
    } else {
      assertCanTouchStatus(req, 'posts.publish', before);
      patch = {};
    }
    if (!patch.seo) delete patch.seo;
    if (patch.slug) {
      patch.slug = slugify(patch.slug);
      if (s.posts.some((p) => p.id !== id && p.slug === patch.slug)) throw new HttpError(409, 'Ce slug est déjà utilisé');
    }
    await saveRevision({ entityType: 'post', entityId: id, label: before.title, snapshot: before, authorEmail: req.admin?.email });
    const updated = await updateSnapshot((snap) => {
      const idx = snap.posts.findIndex((p) => p.id === id);
      const next = { ...snap.posts[idx], ...patch, updatedAt: new Date().toISOString() };
      if (next.status === 'published' && !next.publishedAt) next.publishedAt = next.updatedAt;
      if (next.status === 'scheduled' && !(next.scheduledAt || before.scheduledAt)) {
        throw new HttpError(400, 'Date de publication planifiée requise pour un article planifié');
      }
      snap.posts[idx] = next;
    });
    const post = updated.posts.find((p) => p.id === id)!;
    res.locals.audit = { target: post.title, detail: before.status !== post.status ? { status: { from: before.status, to: post.status } } : undefined };
    res.json({ ...post, seoScore: analyzePostSeo(post).score });
  });

  router.delete('/posts/:id', requirePerm('posts.delete'), async (req, res) => {
    let title = '';
    await updateSnapshot((s) => {
      const post = s.posts.find((p) => p.id === req.params.id);
      if (!post) throw new HttpError(404, 'Article introuvable');
      title = post.title;
      s.posts = s.posts.filter((p) => p.id !== req.params.id);
    });
    res.locals.audit = { target: title };
    res.json({ ok: true });
  });

  router.get('/posts/:id/revisions', requireAuth(), async (req, res) => {
    const revs = await listRevisions('post', req.params.id);
    res.json(revs.map(({ snapshot, ...r }) => ({ ...r, title: snapshot.title })));
  });

  router.post('/posts/:id/revisions/:revId/restore', requirePerm('posts.edit'), async (req: AuthedRequest, res) => {
    const rev = await getRevision(req.params.revId);
    if (!rev || rev.entityType !== 'post' || rev.entityId !== req.params.id) throw new HttpError(404, 'Révision introuvable');
    const current = (await loadSnapshot()).posts.find((p) => p.id === req.params.id);
    if (current) assertCanTouchStatus(req, 'posts.publish', current, (rev.snapshot as BlogPost).status);
    // Snapshot de l’état courant avant écrasement (comme pour les pages).
    if (current) await saveRevision({ entityType: 'post', entityId: current.id, label: current.title, snapshot: current, authorEmail: req.admin?.email });
    res.locals.audit = { target: current?.title };
    const updated = await updateSnapshot((s) => {
      const idx = s.posts.findIndex((p) => p.id === req.params.id);
      if (idx === -1) throw new HttpError(404, 'Article introuvable');
      s.posts[idx] = { ...(rev.snapshot as BlogPost), updatedAt: new Date().toISOString() };
    });
    res.json(updated.posts.find((p) => p.id === req.params.id));
  });

  /* ---------- SEO ---------- */

  router.get('/seo/overview', requireAuth(), async (_req, res) => {
    const s = await loadSnapshot();
    res.json([
      ...s.pages.map((p) => ({ kind: 'page' as const, id: p.id, title: p.title, url: p.path, status: p.status, seo: p.seo, analysis: analyzePageSeo(p) })),
      ...s.posts.map((p) => ({ kind: 'post' as const, id: p.id, title: p.title, url: `/blog/${p.slug}/`, status: p.status, seo: p.seo, analysis: analyzePostSeo(p) })),
    ]);
  });

  /* ---------- Formulaires ---------- */

  router.get('/forms', requirePerm('forms.view', 'forms.manage'), async (req: AuthedRequest, res) => {
    const s = await loadSnapshot();
    res.json({ forms: s.forms, submissions: hasPerm(req, 'forms.view') ? s.formSubmissions : [] });
  });

  router.put('/forms/:id', requirePerm('forms.manage'), async (req, res) => {
    const body = req.body as CmsSnapshot['forms'][number];
    const names = new Set<string>();
    for (const f of body.fields || []) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(f.name)) throw new HttpError(400, `Identifiant de champ invalide : « ${f.name} »`);
      if (names.has(f.name)) throw new HttpError(400, `Champ en double : ${f.name}`);
      names.add(f.name);
    }
    for (const e of body.recipientEmails || []) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, `E-mail destinataire invalide : ${e}`);
    }
    await updateSnapshot((s) => {
      const idx = s.forms.findIndex((f) => f.id === req.params.id);
      if (idx === -1) throw new HttpError(404, 'Formulaire introuvable');
      s.forms[idx] = {
        ...s.forms[idx],
        ...pick<CmsSnapshot['forms'][number]>(body, ['name', 'recipientEmails', 'successPath', 'fields', 'enabled']),
      };
    });
    res.json({ ok: true });
  });

  router.patch('/submissions/:id', requirePerm('forms.view'), async (req, res) => {
    res.locals.audit = false;
    await updateSnapshot((s) => {
      const sub = s.formSubmissions.find((x) => x.id === req.params.id);
      if (!sub) throw new HttpError(404, 'Message introuvable');
      if (typeof req.body.read === 'boolean') sub.read = req.body.read;
    });
    res.json({ ok: true });
  });

  router.delete('/submissions/:id', requirePerm('forms.manage'), async (req, res) => {
    await updateSnapshot((s) => {
      s.formSubmissions = s.formSubmissions.filter((x) => x.id !== req.params.id);
    });
    res.json({ ok: true });
  });

  /* ---------- Statistiques ---------- */

  router.get('/analytics', requirePerm('analytics.view'), async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const s = await loadSnapshot();
    res.json(await summarizeAnalytics(days, new URL(s.settings.publicUrl).hostname));
  });

  /* ---------- Médias ---------- */

  router.get('/media', requireAuth(), async (_req, res) => {
    res.json((await loadSnapshot()).media);
  });

  router.get('/media/limits', requireAuth(), async (_req, res) => {
    const u = (await loadSnapshot()).system.uploads;
    res.json({ ...u, label: allowedLabel(u) });
  });

  router.post('/media/upload', requirePerm('media.upload'), async (req, res) => {
    const { filename, dataBase64, mimeType, alt } = req.body as { filename?: string; dataBase64?: string; mimeType?: string; alt?: string };
    if (!filename || !dataBase64 || !mimeType) throw new HttpError(400, 'Fichier requis');
    const limits = (await loadSnapshot()).system.uploads;
    if (!allowedMime(limits, mimeType)) throw new HttpError(415, `Format non autorisé (formats acceptés : ${allowedLabel(limits)})`);
    const buf = Buffer.from(dataBase64, 'base64');
    if (buf.length > limits.maxSizeMb * 1024 * 1024) throw new HttpError(413, `Fichier trop lourd (${limits.maxSizeMb} Mo max)`);
    const { UPLOADS_DIR } = getDataPaths();
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const base = slugify(path.basename(filename, path.extname(filename))).slice(0, 60) || 'fichier';
    const safeName = `${base}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    await fs.writeFile(path.join(UPLOADS_DIR, safeName), buf);
    const asset = {
      id: crypto.randomUUID(),
      filename: safeName,
      url: `/uploads/${safeName}`,
      mimeType,
      sizeBytes: buf.length,
      alt: alt || '',
      createdAt: new Date().toISOString(),
    };
    await updateSnapshot((s) => {
      s.media.unshift(asset);
    });
    res.locals.audit = { target: safeName };
    res.status(201).json(asset);
  });

  router.patch('/media/:id', requirePerm('media.upload'), async (req, res) => {
    await updateSnapshot((s) => {
      const m = s.media.find((x) => x.id === req.params.id);
      if (!m) throw new HttpError(404, 'Média introuvable');
      if (typeof req.body.alt === 'string') m.alt = req.body.alt;
    });
    res.json({ ok: true });
  });

  router.delete('/media/:id', requirePerm('media.delete'), async (req, res) => {
    const s = await loadSnapshot();
    const asset = s.media.find((x) => x.id === req.params.id);
    if (!asset) throw new HttpError(404, 'Média introuvable');
    await updateSnapshot((snap) => {
      snap.media = snap.media.filter((x) => x.id !== asset.id);
    });
    await fs.unlink(path.join(getDataPaths().UPLOADS_DIR, path.basename(asset.filename))).catch(() => undefined);
    res.locals.audit = { target: asset.filename };
    res.json({ ok: true });
  });

  /* ---------- Newsletter ---------- */

  router.get('/subscribers', requirePerm('newsletter.manage'), async (_req, res) => {
    res.json((await loadSnapshot()).subscribers.map(({ confirmToken, ...rest }) => rest));
  });

  router.patch('/subscribers/:id', requirePerm('newsletter.manage'), async (req, res) => {
    const status = req.body.status;
    if (!['pending', 'active', 'unsubscribed'].includes(status)) throw new HttpError(400, 'Statut invalide');
    let email = '';
    await updateSnapshot((s) => {
      const sub = s.subscribers.find((x) => x.id === req.params.id);
      if (!sub) throw new HttpError(404, 'Abonné introuvable');
      sub.status = status;
      email = sub.email;
    });
    res.locals.audit = { target: email, detail: { status } };
    res.json({ ok: true });
  });

  router.delete('/subscribers/:id', requirePerm('newsletter.manage'), async (req, res) => {
    let email = '';
    await updateSnapshot((s) => {
      email = s.subscribers.find((x) => x.id === req.params.id)?.email ?? '';
      s.subscribers = s.subscribers.filter((x) => x.id !== req.params.id);
    });
    res.locals.audit = { target: email || req.params.id };
    res.json({ ok: true });
  });

  return router;
}
