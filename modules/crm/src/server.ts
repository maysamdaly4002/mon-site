import { defineServerModule } from '@snapify/sdk';
import { CrmError } from '../core/errors';
import { CrmService } from '../core/services';
import { snapifyRepository } from '../adapters/snapify/repository';

/**
 * Couche fine entre Snapify et le cœur métier. Toute la logique est dans core/.
 *
 * ⚠ À VÉRIFIER dans sdk/index.ts : la forme de l'argument reçu par les handlers (corps, query, params).
 *   `input()` ci-dessous accepte les variantes courantes ; si besoin, c'est la seule fonction à adapter.
 * Les routes n'utilisent que GET/POST (les seuls verbes vus dans le modèle) et renvoient une enveloppe
 * { ok, data | error } pour ne pas dépendre de la gestion des codes HTTP.
 */
type Envelope = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; details?: unknown } };

const input = (req: any): Record<string, any> => ({
  ...(req?.query ?? {}),
  ...(req?.params ?? {}),
  ...(req?.body && typeof req.body === 'object' ? req.body : {}),
});

async function run(fn: () => Promise<unknown>): Promise<Envelope> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof CrmError) return { ok: false, error: { code: e.code, message: e.message, details: e.details } };
    console.error('[crm]', e);
    return { ok: false, error: { code: 'internal', message: 'Erreur interne' } };
  }
}

export default defineServerModule<Record<string, never>>({
  activate(ctx) {
    const crm = new CrmService(snapifyRepository((name) => (ctx as any).db.collection(name)));
    /** Les collections JSON n'ont pas de contrainte UNIQUE : on sérialise les écritures pour garantir l'unicité de l'e-mail. */
    const write = (fn: () => Promise<unknown>) => run(() => ctx.lock('crm', fn));

    // ── Public : capture de leads — POST /api/modules/<id>/leads
    ctx.http.post('/leads', (req: any) => write(() => crm.captureLead(input(req))));

    // ── Administration — /api/admin/modules/<id>/api/…
    const a = ctx.admin;
    a.get('/contacts', (req: any) => run(() => crm.listContacts(input(req))));
    a.get('/contact', (req: any) => run(() => crm.contactDetail(input(req).id)));
    a.post('/contact/save', (req: any) => write(() => { const { id, ...d } = input(req); return id ? crm.updateContact(id, d) : crm.createContact(d); }));
    a.post('/contact/delete', (req: any) => write(() => crm.deleteContact(input(req).id)));
    a.post('/activity/add', (req: any) => write(() => { const { contactId, ...d } = input(req); return crm.addActivity(contactId, d); }));

    a.get('/companies', (req: any) => run(() => crm.listCompanies(input(req))));
    a.get('/company', (req: any) => run(() => crm.companyDetail(input(req).id)));
    a.post('/company/save', (req: any) => write(() => { const { id, ...d } = input(req); return id ? crm.updateCompany(id, d) : crm.createCompany(d); }));
    a.post('/company/delete', (req: any) => write(() => crm.deleteCompany(input(req).id)));

    a.get('/pipeline', () => run(() => crm.pipeline()));
    a.post('/deal/save', (req: any) => write(() => { const { id, ...d } = input(req); return id ? crm.updateDeal(id, d) : crm.createDeal(d); }));
    a.post('/deal/move', (req: any) => write(() => { const d = input(req); return crm.moveDeal(d.id, d.stage, d.position); }));
    a.post('/deal/delete', (req: any) => write(() => crm.deleteDeal(input(req).id)));

    a.get('/dashboard', () => run(() => crm.dashboard()));
    a.get('/export', () => run(async () => ({ csv: await crm.exportCsv() })));
    a.post('/import', (req: any) => write(() => { const d = input(req); return crm.importCsv(String(d.csv ?? ''), { onDuplicate: d.onDuplicate === 'update' ? 'update' : 'skip', dryRun: !!d.dryRun }); }));

    /** Indicateurs de la fiche du module. */
    ctx.admin.status(async () => {
      const d = await crm.dashboard();
      return { stats: [{ label: 'Contacts', value: d.totalContacts }, { label: 'Affaires ouvertes', value: d.deals.open }] };
    });
  },
});
