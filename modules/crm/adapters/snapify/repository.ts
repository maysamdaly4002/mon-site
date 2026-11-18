import type { CrmRepository } from '../../core/repository';
import type { Activity, Company, Contact, Deal, Stage } from '../../core/types';

/**
 * Dépôt pour les collections Snapify (`ctx.db.collection(name)` → table module_records, JSONB).
 * Interface minimale recopiée de server/modules/records.ts : le cœur n'importe rien du CMS.
 */
export interface CollectionLike<T> {
  get(id: string): Promise<(T & Meta) | null>;
  find(q?: {
    where?: Record<string, unknown>;
    filters?: { field: string; op: 'eq' | 'ne' | 'in' | 'contains'; value: unknown }[];
    search?: { text: string; fields: string[] };
    orderBy?: { field: string; dir: 'asc' | 'desc'; numeric?: boolean }[];
    limit?: number;
    offset?: number;
  }): Promise<{ items: (T & Meta)[]; total: number }>;
  findOne(where: Record<string, unknown>): Promise<(T & Meta) | null>;
  insert(data: T): Promise<T & Meta>;
  update(id: string, patch: Partial<T>): Promise<(T & Meta) | null>;
  delete(id: string): Promise<boolean>;
}
interface Meta { id: string; createdAt: string; updatedAt: string }
export type CollectionFactory = <T>(name: string) => CollectionLike<T>;

const strip = <T extends object>(r: T & Meta, keepCreated = true): any => {
  const { updatedAt: _u, ...rest } = r as any;
  if (!keepCreated) delete rest.createdAt;
  return rest;
};

export function snapifyRepository(collection: CollectionFactory): CrmRepository {
  const contacts = collection<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>('contacts');
  const companies = collection<Omit<Company, 'id' | 'createdAt'>>('companies');
  const deals = collection<Omit<Deal, 'id' | 'createdAt'>>('deals');
  const activities = collection<Omit<Activity, 'id'>>('activities');

  /** Parcourt toute une collection par pages de 500 (limite du CMS). */
  async function all<T>(c: CollectionLike<T>, where?: Record<string, unknown>) {
    const out: (T & Meta)[] = [];
    for (let offset = 0; ; offset += 500) {
      const { items, total } = await c.find({ where, limit: 500, offset });
      out.push(...items);
      if (offset + 500 >= total) return out;
    }
  }
  const asContact = (r: Contact & Meta): Contact => r as Contact;

  return {
    contacts: {
      async list(q) {
        const filters: any[] = [];
        if (q.tag) filters.push({ field: 'tags', op: 'contains', value: q.tag });
        const where: Record<string, unknown> = {};
        if (q.companyId) where.companyId = q.companyId;
        if (q.source) where.source = q.source;
        const r = await contacts.find({
          where, filters,
          search: q.q ? { text: q.q, fields: ['firstName', 'lastName', 'email', 'phone'] } : undefined,
          orderBy: [{ field: 'createdAt', dir: 'desc' }],
          limit: q.size, offset: (q.page - 1) * q.size,
        });
        return { items: r.items.map((x) => asContact(x as never)), total: r.total };
      },
      async get(id) { const r = await contacts.get(id); return r ? asContact(r as never) : null; },
      async findByEmail(email) { const r = await contacts.findOne({ email }); return r ? asContact(r as never) : null; },
      async insert(c) { return asContact((await contacts.insert(c)) as never); },
      async update(id, patch) { const r = await contacts.update(id, patch); return r ? asContact(r as never) : null; },
      async remove(id) {
        for (const d of await all(deals, { contactId: id })) await deals.delete(d.id);
        for (const a of await all(activities, { contactId: id })) await activities.delete(a.id);
        return contacts.delete(id);
      },
      async countBySource() {
        const out: Record<string, number> = {};
        for (const c of await all(contacts)) out[c.source] = (out[c.source] ?? 0) + 1;
        return out;
      },
    },
    companies: {
      async list(q) {
        const r = await companies.find({ search: q.q ? { text: q.q, fields: ['name'] } : undefined, orderBy: [{ field: 'name', dir: 'asc' }], limit: q.size, offset: (q.page - 1) * q.size });
        return { items: r.items.map((x) => strip(x) as Company), total: r.total };
      },
      async get(id) { const r = await companies.get(id); return r ? (strip(r) as Company) : null; },
      async insert(c) { return strip(await companies.insert(c)) as Company; },
      async update(id, patch) { const r = await companies.update(id, patch); return r ? (strip(r) as Company) : null; },
      async remove(id) {
        for (const c of await all(contacts, { companyId: id })) await contacts.update(c.id, { companyId: null });
        return companies.delete(id);
      },
    },
    deals: {
      async list(f) {
        const where: Record<string, unknown> = {};
        if (f.contactId) where.contactId = f.contactId;
        if (f.stage) where.stage = f.stage as Stage;
        const out: (Deal & Meta)[] = [];
        for (let offset = 0; ; offset += 500) {
          const { items, total } = await deals.find({ where, orderBy: [{ field: 'position', dir: 'asc', numeric: true }, { field: 'createdAt', dir: 'asc' }], limit: 500, offset });
          out.push(...(items as never[]));
          if (offset + 500 >= total) break;
        }
        return out.map((d) => strip(d) as Deal);
      },
      async get(id) { const r = await deals.get(id); return r ? (strip(r) as Deal) : null; },
      async insert(d) { return strip(await deals.insert(d)) as Deal; },
      async update(id, patch) { const r = await deals.update(id, patch); return r ? (strip(r) as Deal) : null; },
      async remove(id) { return deals.delete(id); },
    },
    activities: {
      async listByContact(contactId) {
        const rows = await all(activities, { contactId });
        return rows.map((a) => strip(a, false) as Activity).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      },
      async insert(a) { return strip(await activities.insert(a), false) as Activity; },
    },
    tags: {
      async list() { return [...new Set((await all(contacts)).flatMap((c) => c.tags))].sort(); },
    },
  };
}
