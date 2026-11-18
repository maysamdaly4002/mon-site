import type { z } from 'zod';
import type { CrmRepository } from './repository';
import { activityInput, companyInput, companyPatch, contactInput, contactPatch, dealInput, dealPatch, idSchema, leadInput, queryInput, stageEnum } from './schemas';
import { parseCsv, toCsv } from './csv';
import { conflict, CrmError, invalid, notFound } from './errors';
import { OPEN_STAGES, STAGES, type Contact, type Deal, type Stage } from './types';

/** Probabilité de gain par étape, utilisée pour le chiffre d'affaires prévu (pondéré). */
export const STAGE_WEIGHT: Record<Stage, number> = { nouveau: 0.1, qualifie: 0.3, proposition: 0.6, gagne: 1, perdu: 0 };
export const STAGE_LABEL: Record<Stage, string> = { nouveau: 'Nouveau', qualifie: 'Qualifié', proposition: 'Proposition', gagne: 'Gagné', perdu: 'Perdu' };

/** Valide une entrée avec zod et convertit l'échec en CrmError('validation'). */
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
  throw invalid(Object.values(fields)[0] ?? 'Données invalides', fields);
}

export interface ImportReport {
  total: number;
  created: number;
  updated: number;
  duplicates: { line: number; email: string; reason: 'dans_le_fichier' | 'deja_en_base' }[];
  errors: { line: number; message: string }[];
}

const HEADERS: Record<string, string> = {
  prenom: 'firstName', 'prénom': 'firstName', firstname: 'firstName', first_name: 'firstName',
  nom: 'lastName', lastname: 'lastName', last_name: 'lastName',
  email: 'email', 'e-mail': 'email', mail: 'email',
  telephone: 'phone', 'téléphone': 'phone', phone: 'phone', tel: 'phone',
  source: 'source', tags: 'tags', societe: 'company', 'société': 'company', entreprise: 'company', company: 'company',
};

export class CrmService {
  constructor(private repo: CrmRepository) {}

  // ───────── Contacts ─────────
  listContacts(raw: unknown) {
    return this.repo.contacts.list(parse(queryInput, raw));
  }

  async getContact(id: string) {
    const c = await this.repo.contacts.get(parse(idSchema, id));
    if (!c) throw notFound('Contact');
    return c;
  }

  /** Fiche complète : contact + entreprise + affaires + timeline. */
  async contactDetail(id: string) {
    const contact = await this.getContact(id);
    const [company, deals, timeline] = await Promise.all([
      contact.companyId ? this.repo.companies.get(contact.companyId) : null,
      this.repo.deals.list({ contactId: contact.id }),
      this.repo.activities.listByContact(contact.id),
    ]);
    return { contact, company, deals, timeline };
  }

  async createContact(raw: unknown): Promise<Contact> {
    const d = parse(contactInput, raw);
    await this.assertEmailFree(d.email ?? null);
    await this.assertCompany(d.companyId ?? null);
    return this.repo.contacts.insert({ ...d, email: d.email ?? null, companyId: d.companyId ?? null });
  }

  async updateContact(id: string, raw: unknown): Promise<Contact> {
    const cur = await this.getContact(id);
    const d = parse(contactPatch, raw);
    if (d.email !== undefined && d.email !== cur.email) await this.assertEmailFree(d.email ?? null, cur.id);
    if (d.companyId) await this.assertCompany(d.companyId);
    const row = await this.repo.contacts.update(cur.id, d as never);
    if (!row) throw notFound('Contact');
    return row;
  }

  async deleteContact(id: string) {
    if (!(await this.repo.contacts.remove(parse(idSchema, id)))) throw notFound('Contact');
  }

  private async assertEmailFree(email: string | null, selfId?: string) {
    if (!email) return;
    const dup = await this.repo.contacts.findByEmail(email);
    if (dup && dup.id !== selfId) throw conflict('Un contact avec cet e-mail existe déjà', { contactId: dup.id });
  }
  private async assertCompany(id: string | null) {
    if (id && !(await this.repo.companies.get(id))) throw invalid('Entreprise inconnue', { companyId: id });
  }

  // ───────── Entreprises ─────────
  listCompanies(raw: { q?: string; page?: number; size?: number } = {}) {
    const p = parse(queryInput.pick({ q: true, page: true, size: true }), raw);
    return this.repo.companies.list({ q: p.q, page: p.page, size: p.size });
  }
  async companyDetail(id: string) {
    const company = await this.repo.companies.get(parse(idSchema, id));
    if (!company) throw notFound('Entreprise');
    const { items } = await this.repo.contacts.list({ companyId: company.id, page: 1, size: 100 });
    return { company, contacts: items };
  }
  createCompany(raw: unknown) { return this.repo.companies.insert(parse(companyInput, raw)); }
  async updateCompany(id: string, raw: unknown) {
    const row = await this.repo.companies.update(parse(idSchema, id), parse(companyPatch, raw));
    if (!row) throw notFound('Entreprise');
    return row;
  }
  async deleteCompany(id: string) {
    if (!(await this.repo.companies.remove(parse(idSchema, id)))) throw notFound('Entreprise');
  }

  // ───────── Pipeline ─────────
  async createDeal(raw: unknown): Promise<Deal> {
    const d = parse(dealInput, raw);
    await this.getContact(d.contactId);
    const column = await this.repo.deals.list({ stage: d.stage });
    const deal = await this.repo.deals.insert({ ...d, expectedClose: d.expectedClose ?? null, position: column.length });
    await this.log(d.contactId, `Affaire créée : « ${d.title} » (${STAGE_LABEL[d.stage]})`);
    return deal;
  }

  async updateDeal(id: string, raw: unknown) {
    const cur = await this.repo.deals.get(parse(idSchema, id));
    if (!cur) throw notFound('Affaire');
    const p = parse(dealPatch, raw);
    const { stage, ...rest } = p;
    const row = await this.repo.deals.update(cur.id, rest as never);
    if (stage && stage !== cur.stage) return this.moveDeal(cur.id, stage);
    return row!;
  }

  /** Déplace une affaire (kanban) : change l'étape, réordonne la colonne et journalise sur la timeline. */
  async moveDeal(id: string, rawStage: unknown, rawPosition?: unknown): Promise<Deal> {
    const stage = parse(stageEnum, rawStage);
    const deal = await this.repo.deals.get(parse(idSchema, id));
    if (!deal) throw notFound('Affaire');
    const target = (await this.repo.deals.list({ stage })).filter((d) => d.id !== deal.id);
    const pos = Math.min(Math.max(Number.isFinite(Number(rawPosition)) ? Math.floor(Number(rawPosition)) : target.length, 0), target.length);
    target.splice(pos, 0, { ...deal, stage });
    await Promise.all(target.map((d, i) => (d.id === deal.id || d.position !== i ? this.repo.deals.update(d.id, d.id === deal.id ? { stage, position: i } : { position: i }) : null)));
    if (stage !== deal.stage) await this.log(deal.contactId, `Affaire « ${deal.title} » : ${STAGE_LABEL[deal.stage]} → ${STAGE_LABEL[stage]}`);
    return (await this.repo.deals.get(deal.id))!;
  }

  async deleteDeal(id: string) {
    if (!(await this.repo.deals.remove(parse(idSchema, id)))) throw notFound('Affaire');
  }

  /** Colonnes du kanban avec totaux. */
  async pipeline() {
    const all = await this.repo.deals.list({});
    const contacts = new Map<string, Contact | null>();
    for (const id of new Set(all.map((d) => d.contactId))) contacts.set(id, await this.repo.contacts.get(id));
    return STAGES.map((stage) => {
      const deals = all.filter((d) => d.stage === stage).map((d) => ({ ...d, contactName: contacts.get(d.contactId) ? `${contacts.get(d.contactId)!.firstName} ${contacts.get(d.contactId)!.lastName}`.trim() : '' }));
      return { stage, label: STAGE_LABEL[stage], deals, total: deals.reduce((s, d) => s + d.amount, 0) };
    });
  }

  // ───────── Historique ─────────
  async addActivity(contactId: string, raw: unknown) {
    const c = await this.getContact(contactId);
    const a = parse(activityInput, raw);
    return this.repo.activities.insert({ contactId: c.id, type: a.type, note: a.note, occurredAt: a.occurredAt ?? new Date().toISOString() });
  }
  private log(contactId: string, note: string) {
    return this.repo.activities.insert({ contactId, type: 'note', note, occurredAt: new Date().toISOString() });
  }

  // ───────── Capture de leads (formulaire public) ─────────
  async captureLead(raw: unknown): Promise<{ ok: true; created: boolean; ignored?: boolean }> {
    const d = parse(leadInput, raw);
    if (d.website.trim() !== '') return { ok: true, created: false, ignored: true }; // honeypot : on fait semblant de réussir
    const existing = await this.repo.contacts.findByEmail(d.email);
    if (existing) {
      await this.log(existing.id, `Nouveau message via ${d.source}${d.message ? ` : ${d.message}` : ''}`);
      return { ok: true, created: false };
    }
    const [firstName, ...rest] = d.name.split(/\s+/).filter(Boolean);
    const contact = await this.repo.contacts.insert({
      firstName: rest.length ? firstName : '',
      lastName: rest.length ? rest.join(' ') : firstName || d.email.split('@')[0],
      email: d.email, phone: d.phone, companyId: null, source: d.source, tags: [],
    });
    await this.log(contact.id, `Lead capturé via ${d.source}${d.company ? ` (société : ${d.company})` : ''}${d.message ? ` : ${d.message}` : ''}`);
    return { ok: true, created: true };
  }

  // ───────── Import / export CSV (bonus) ─────────
  async exportCsv() {
    const rows: unknown[][] = [['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Entreprise', 'Source', 'Tags', 'Créé le']];
    const names = new Map<string, string>();
    for (let page = 1; ; page++) {
      const { items, total } = await this.repo.contacts.list({ page, size: 100 });
      for (const c of items) {
        if (c.companyId && !names.has(c.companyId)) names.set(c.companyId, (await this.repo.companies.get(c.companyId))?.name ?? '');
        rows.push([c.firstName, c.lastName, c.email, c.phone, names.get(c.companyId ?? '') ?? '', c.source, c.tags.join('|'), c.createdAt]);
      }
      if (page * 100 >= total) break;
    }
    return toCsv(rows);
  }

  /** Import avec détection de doublons : même e-mail dans le fichier ou déjà en base. */
  async importCsv(csv: string, opts: { onDuplicate?: 'skip' | 'update'; dryRun?: boolean } = {}): Promise<ImportReport> {
    const grid = parseCsv(csv);
    if (grid.length < 2) throw invalid('Fichier vide ou sans en-tête');
    if (grid.length > 5001) throw invalid('Import limité à 5 000 lignes');
    const cols = grid[0].map((h) => HEADERS[h.trim().toLowerCase()] ?? '');
    if (!cols.includes('lastName') && !cols.includes('email')) throw invalid('Colonnes « Nom » ou « E-mail » introuvables');
    const report: ImportReport = { total: grid.length - 1, created: 0, updated: 0, duplicates: [], errors: [] };
    const seen = new Set<string>();
    const companyCache = new Map<string, string>();
    for (let i = 1; i < grid.length; i++) {
      const line = i + 1;
      const rec: Record<string, string> = {};
      grid[i].forEach((v, k) => { if (cols[k]) rec[cols[k]] = v; });
      try {
        const email = rec.email?.trim().toLowerCase() ?? '';
        if (email && seen.has(email)) { report.duplicates.push({ line, email, reason: 'dans_le_fichier' }); continue; }
        if (email) seen.add(email);
        const existing = email ? await this.repo.contacts.findByEmail(email) : null;
        if (existing && !opts.dryRun && opts.onDuplicate === 'update') {
          await this.updateContact(existing.id, { firstName: rec.firstName, lastName: rec.lastName || existing.lastName, phone: rec.phone, tags: rec.tags ? rec.tags.split('|') : undefined });
          report.updated++;
          report.duplicates.push({ line, email, reason: 'deja_en_base' });
          continue;
        }
        if (existing) { report.duplicates.push({ line, email, reason: 'deja_en_base' }); continue; }
        let companyId: string | undefined;
        if (rec.company?.trim() && !opts.dryRun) {
          const key = rec.company.trim().toLowerCase();
          if (!companyCache.has(key)) companyCache.set(key, (await this.createCompany({ name: rec.company })).id);
          companyId = companyCache.get(key);
        }
        const input = { firstName: rec.firstName ?? '', lastName: rec.lastName || (email ? email.split('@')[0] : ''), email, phone: rec.phone ?? '', source: rec.source || 'import', tags: rec.tags ? rec.tags.split('|') : [], companyId };
        if (opts.dryRun) parse(contactInput, input); else await this.createContact(input);
        report.created++;
      } catch (e) {
        report.errors.push({ line, message: e instanceof CrmError ? e.message : 'Ligne invalide' });
      }
    }
    return report;
  }

  // ───────── Tableau de bord (bonus) ─────────
  async dashboard() {
    const [bySource, deals, tags] = await Promise.all([this.repo.contacts.countBySource(), this.repo.deals.list({}), this.repo.tags.list()]);
    const won = deals.filter((d) => d.stage === 'gagne');
    const lost = deals.filter((d) => d.stage === 'perdu');
    const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
    const sum = (a: Deal[]) => a.reduce((s, d) => s + d.amount, 0);
    return {
      leadsBySource: Object.entries(bySource).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      totalContacts: Object.values(bySource).reduce((s, n) => s + n, 0),
      deals: { total: deals.length, open: open.length, won: won.length, lost: lost.length },
      /** Taux de conversion = affaires gagnées / affaires clôturées (gagnées + perdues). */
      conversionRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 1000) / 10 : 0,
      wonRevenue: sum(won),
      openPipeline: sum(open),
      forecastRevenue: Math.round(deals.reduce((s, d) => s + (OPEN_STAGES.includes(d.stage) ? d.amount * STAGE_WEIGHT[d.stage] : 0), 0)),
      tags,
    };
  }
}
