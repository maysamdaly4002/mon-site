import { defineServerModule } from '@snapify/sdk';
import { ErpError } from '../core/errors';
import { ErpService, consoleMailer, type Mailer } from '../core/services';
import { snapifyRepository } from '../adapters/snapify/repository';
import type { Actor } from '../core/types';
import { routes, type Input } from './routes';

/**
 * Couche fine entre Snapify et le cœur métier (même principe que le module CRM).
 *
 * ⚠ À VÉRIFIER dans sdk/index.ts (trois points, tous isolés dans ce fichier) :
 *   1. `input()` : forme de l'argument reçu par les handlers (query, params, body) ;
 *   2. `actorOf()` : comment retrouver l'administrateur connecté (ici : nom lu sur req.user s'il existe) ;
 *   3. `mailer` : API d'envoi d'e-mail du CMS (ctx.mail.send ?) ; à défaut, les alertes sont journalisées.
 * Les routes d'administration sont déjà protégées par la session du CMS : l'acteur est donc « admin ».
 * Le contrôle par rôle et par établissement reste appliqué par ErpService (utile dès que Snapify fournira des rôles).
 */
/** Types créés au premier démarrage si aucun n'existe (modifiables ensuite dans « Règles de périodicité »). Valeurs indicatives : à valider avec la réglementation. */
const DEFAULT_TYPES = [['extincteur', 'Extincteur', 12], ['alarme', 'Alarme incendie', 12], ['eclairage_securite', 'Éclairage de sécurité (BAES)', 12], ['desenfumage', 'Désenfumage', 12], ['ria', 'Robinet d’incendie armé (RIA)', 12], ['issue_secours', 'Issue de secours', 3]] as const;
const SYSTEM: Actor = { id: 'system', nom: 'Système', role: 'admin', etablissementIds: '*' };

type Envelope = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; details?: unknown } };

const input = (req: any): Input => ({ ...(req?.query ?? {}), ...(req?.params ?? {}), ...(req?.body && typeof req.body === 'object' ? req.body : {}) });
const actorOf = (req: any): Actor => ({ id: String(req?.user?.id ?? 'snapify-admin'), nom: String(req?.user?.name ?? req?.user?.email ?? 'Administrateur'), role: 'admin', etablissementIds: '*' });

async function run(fn: () => Promise<unknown>): Promise<Envelope> {
  try { return { ok: true, data: await fn() }; }
  catch (e) {
    if (e instanceof ErpError) return { ok: false, error: { code: e.code, message: e.message, details: e.details } };
    console.error('[erp-incendie]', e);
    return { ok: false, error: { code: 'internal', message: 'Erreur interne' } };
  }
}

export default defineServerModule<Record<string, never>>({
  activate(ctx) {
    const c = ctx as any;
    const mailer: Mailer = c.mail?.send ? { send: (to, subject, text) => c.mail.send({ to, subject, text }) } : consoleMailer;
    const erp = new ErpService(snapifyRepository((name) => c.db.collection(name)), { mailer });
    void Promise.resolve(ctx.lock('erp-incendie', async () => {
      if ((await erp.listTypes(SYSTEM)).length) return;
      for (const [code, libelle, periodiciteDefautMois] of DEFAULT_TYPES) await erp.createType(SYSTEM, { code, libelle, periodiciteDefautMois });
    })).catch((e) => console.error('[erp-incendie] types par défaut', e));
    for (const r of routes) {
      // Les collections JSON n'ont ni transaction ni contrainte UNIQUE : toute écriture est sérialisée (aussi l'ajout au registre).
      const handler = (req: any) => run(() => (r.write ? ctx.lock('erp-incendie', () => r.run(erp, actorOf(req), input(req))) : r.run(erp, actorOf(req), input(req))));
      if (r.method === 'GET') ctx.admin.get(r.path, handler); else ctx.admin.post(r.path, handler);
    }
    ctx.admin.status(async () => {
      const d = await erp.dashboard(actorOf(null));
      return { stats: [{ label: 'Équipements', value: d.global.equipements }, { label: 'En retard', value: d.global.enRetard }, { label: 'Non-conformités ouvertes', value: d.global.ncOuvertes }] };
    });
  },
});
