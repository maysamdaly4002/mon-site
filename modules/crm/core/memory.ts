import crypto from 'node:crypto';
import type { CrmRepository } from './repository';
import type { Activity, Company, Contact, Deal } from './types';

const uid = () => crypto.randomBytes(9).toString('base64url');
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const page = <T>(all: T[], p: number, size: number) => ({ items: all.slice((p - 1) * size, p * size), total: all.length });

/** Dépôt en mémoire : sert aux tests et à la démo sans base de données. */
export function memoryRepository(): CrmRepository {
  const contacts = new Map<string, Contact>();
  const companies = new Map<string, Company>();
  const deals = new Map<string, Deal>();
  const activities = new Map<string, Activity>();
  const now = () => new Date().toISOString();
  const patchOf = <T extends object>(cur: T, p: object): T => ({ ...cur, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) }) as T;

  return {
    contacts: {
      async list(q) {
        const needle = q.q ? fold(q.q) : '';
        const all = [...contacts.values()]
          .filter((c) => !needle || fold([c.firstName, c.lastName, c.email ?? '', c.phone].join(' ')).includes(needle))
          .filter((c) => !q.companyId || c.companyId === q.companyId)
          .filter((c) => !q.source || c.source === q.source)
          .filter((c) => !q.tag || c.tags.includes(q.tag))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
        return page(all, q.page, q.size);
      },
      async get(id) { return contacts.get(id) ?? null; },
      async findByEmail(email) { return [...contacts.values()].find((c) => c.email === email) ?? null; },
      async insert(c) {
        const row: Contact = { ...c, id: uid(), createdAt: now(), updatedAt: now() };
        contacts.set(row.id, row);
        return row;
      },
      async update(id, p) {
        const cur = contacts.get(id);
        if (!cur) return null;
        const row = { ...patchOf(cur, p), updatedAt: now() };
        contacts.set(id, row);
        return row;
      },
      async remove(id) {
        for (const d of [...deals.values()]) if (d.contactId === id) deals.delete(d.id);
        for (const a of [...activities.values()]) if (a.contactId === id) activities.delete(a.id);
        return contacts.delete(id);
      },
      async countBySource() {
        const out: Record<string, number> = {};
        for (const c of contacts.values()) out[c.source] = (out[c.source] ?? 0) + 1;
        return out;
      },
    },
    companies: {
      async list(q) {
        const needle = q.q ? fold(q.q) : '';
        const all = [...companies.values()].filter((c) => !needle || fold(c.name).includes(needle)).sort((a, b) => a.name.localeCompare(b.name));
        return page(all, q.page, q.size);
      },
      async get(id) { return companies.get(id) ?? null; },
      async insert(c) { const row: Company = { ...c, id: uid(), createdAt: now() }; companies.set(row.id, row); return row; },
      async update(id, p) { const cur = companies.get(id); if (!cur) return null; const row = patchOf(cur, p); companies.set(id, row); return row; },
      async remove(id) {
        for (const c of contacts.values()) if (c.companyId === id) contacts.set(c.id, { ...c, companyId: null });
        return companies.delete(id);
      },
    },
    deals: {
      async list(f) {
        return [...deals.values()]
          .filter((d) => (!f.contactId || d.contactId === f.contactId) && (!f.stage || d.stage === f.stage))
          .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      },
      async get(id) { return deals.get(id) ?? null; },
      async insert(d) { const row: Deal = { ...d, id: uid(), createdAt: now() }; deals.set(row.id, row); return row; },
      async update(id, p) { const cur = deals.get(id); if (!cur) return null; const row = patchOf(cur, p); deals.set(id, row); return row; },
      async remove(id) { return deals.delete(id); },
    },
    activities: {
      async listByContact(contactId) {
        return [...activities.values()].filter((a) => a.contactId === contactId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
      },
      async insert(a) { const row: Activity = { ...a, id: uid() }; activities.set(row.id, row); return row; },
    },
    tags: {
      async list() { return [...new Set([...contacts.values()].flatMap((c) => c.tags))].sort(); },
    },
  };
}
