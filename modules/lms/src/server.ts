import { defineServerModule, type ModuleRequest } from '@snapify/sdk';
import { LmsError } from '../core/errors';
import { LmsService } from '../core/services';
import { snapifyRepository } from '../adapters/snapify/repository';
import type { Actor } from '../core/types';
import { routes, type Input } from './routes';
import { publicRoutes, type Visitor } from './public-api';

/**
 * Couche fine entre Snapify et le cœur métier (même principe que les modules CRM et ERP).
 *
 *  - Routes d'ADMINISTRATION (/api/admin/modules/local.lms/api/…) : protégées par la session du CMS ; l'acteur est l'administrateur
 *    connecté (`req.admin`, fourni par le SDK) avec le rôle « admin ».
 *  - Routes PUBLIQUES (/api/modules/local.lms/public/…) : l'apprenant est le client connecté de l'« Espace client »
 *    (novalabs.customers) ; rôle « apprenant » uniquement (voir src/public-api.ts).
 *
 * À VÉRIFIER (isolé ici) : la forme de l'identité renvoyée par `customers.current(cookies)` — lue de façon défensive (id, firstName,
 * lastName, email).
 */
type Envelope = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; details?: unknown } };
const CUSTOMERS = 'novalabs.customers';
const HTTP_STATUS: Record<LmsError['code'], number> = { validation: 400, unauthenticated: 401, forbidden: 403, not_found: 404, conflict: 409 };

const input = (req: ModuleRequest): Input => ({ ...(req.query ?? {}), ...(req.params ?? {}), ...(req.body && typeof req.body === 'object' ? (req.body as object) : {}) });
const adminActor = (req?: ModuleRequest | null): Actor => ({ id: String(req?.admin?.id ?? 'snapify-admin'), nom: String(req?.admin?.name || req?.admin?.email || 'Administrateur'), email: req?.admin?.email, role: 'admin' });

async function run(fn: () => Promise<unknown>): Promise<Envelope> {
  try { return { ok: true, data: await fn() }; }
  catch (e) {
    if (e instanceof LmsError) return { ok: false, error: { code: e.code, message: e.message, details: e.details } };
    console.error('[lms]', e);
    return { ok: false, error: { code: 'internal', message: 'Erreur interne' } };
  }
}

export default defineServerModule<{ openEnrollment?: boolean; linkByEmail?: boolean; organizationName?: string; signatory?: string; siteUrl?: string }>({
  activate(ctx) {
    const lms = new LmsService(snapifyRepository((name) => ctx.db.collection(name) as any), {
      // Habillage du certificat PDF : réglages « Certificat » du module (lus à chaque génération).
      branding: () => {
        const s = ctx.settings();
        const site = String(s.siteUrl ?? '').trim().replace(/\/+$/, '');
        return { organisation: String(s.organizationName ?? ''), signataire: String(s.signatory ?? ''), verifyBase: site ? `${site}/formation/verifier/` : undefined };
      },
    });

    // Les collections JSON n'ont ni transaction ni contrainte UNIQUE : toute écriture est sérialisée (inscription, progression, certificat…).
    for (const r of routes) {
      const handler = (req: ModuleRequest) => run(() => (r.write ? ctx.lock('lms', () => r.run(lms, adminActor(req), input(req))) : r.run(lms, adminActor(req), input(req))));
      if (r.method === 'GET') ctx.admin.get(r.path, handler); else ctx.admin.post(r.path, handler);
    }
    ctx.admin.status(async () => {
      const d = await lms.dashboard(adminActor());
      return { stats: [{ label: 'Cours publiés', value: d.global.publies }, { label: 'Inscriptions', value: d.global.inscriptions }, { label: 'Certificats délivrés', value: d.global.certificats }] };
    });

    // Espace public : seulement si le module Espace client est actif pour reconnaître les visiteurs.
    const customers = () => ctx.use<{ current: (cookies: Record<string, string>) => Promise<Record<string, any> | null> }>(CUSTOMERS);
    const pub = publicRoutes(lms, {
      accountsAvailable: () => customers() !== null,
      settings: () => { const s = ctx.settings(); return { openEnrollment: s.openEnrollment !== false, linkByEmail: s.linkByEmail === true }; },
      identify: async (cookies): Promise<Visitor | null> => {
        const c = await customers()?.current(cookies);
        if (!c?.id) return null;
        const email = String(c.email ?? '').trim().toLowerCase();
        const nom = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || String(c.name ?? '') || email || 'Apprenant';
        return { id: `client:${c.id}`, nom, email };
      },
    });
    for (const r of pub) {
      const handler = async (req: ModuleRequest) => {
        const pr = { query: req.query ?? {}, body: req.body, cookies: req.cookies ?? {}, ip: req.ip };
        try { return await (r.write ? ctx.lock('lms', () => r.run(pr)) : r.run(pr)); }
        catch (e) {
          if (e instanceof LmsError) throw ctx.error(HTTP_STATUS[e.code], e.message);
          ctx.log.error('[lms] route publique', e);
          throw ctx.error(500, 'Erreur interne');
        }
      };
      if (r.method === 'GET') ctx.http.get(r.path, handler); else ctx.http.post(r.path, handler);
    }
  },
});
