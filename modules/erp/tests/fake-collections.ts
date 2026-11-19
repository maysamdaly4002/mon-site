import crypto from 'node:crypto';
import type { CollectionFactory, CollectionLike } from '../adapters/snapify/repository';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Imite jsonb `@>` : égalité sur les champs de `where`. */
const contains = (data: any, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => JSON.stringify(data[k] ?? null) === JSON.stringify(v ?? null));

/** Faux ctx.db.collection() qui reproduit le comportement documenté de server/modules/records.ts. */
export function fakeCollections(): CollectionFactory {
  const stores = new Map<string, Map<string, any>>();
  return <T>(name: string): CollectionLike<T> => {
    const rows = stores.get(name) ?? new Map<string, any>();
    stores.set(name, rows);
    const out = (r: any) => ({ ...r.data, id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt });
    const clean = (d: any) => { const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = d; return JSON.parse(JSON.stringify(rest)); };
    return {
      async get(id) { const r = rows.get(id); return r ? out(r) : null; },
      async find(q = {}) {
        let list = [...rows.values()].filter((r) => contains(r.data, q.where ?? {}));
        for (const f of q.filters ?? []) if (f.op === 'contains') list = list.filter((r) => (r.data[f.field] ?? []).includes(f.value));
        if (q.search?.text) { const t = fold(q.search.text); list = list.filter((r) => q.search!.fields.some((f) => fold(String(r.data[f] ?? '')).includes(t))); }
        const order = q.orderBy?.length ? q.orderBy : [{ field: 'createdAt', dir: 'desc' as const }];
        list.sort((a, b) => {
          for (const o of order) {
            const av = o.field in a ? a[o.field] : a.data[o.field]; const bv = o.field in b ? b[o.field] : b.data[o.field];
            const c = o.numeric ? Number(av) - Number(bv) : String(av ?? '').localeCompare(String(bv ?? ''));
            if (c) return o.dir === 'asc' ? c : -c;
          }
          return a.id.localeCompare(b.id);
        });
        const limit = Math.min(500, q.limit ?? 100), offset = q.offset ?? 0;
        return { items: list.slice(offset, offset + limit).map(out), total: list.length };
      },
      async findOne(where) { const r = [...rows.values()].find((x) => contains(x.data, where)); return r ? out(r) : null; },
      async insert(data) {
        const now = new Date(Date.now() + rows.size).toISOString(); // ordre stable
        const r = { id: crypto.randomBytes(9).toString('base64url'), data: clean(data), createdAt: now, updatedAt: now };
        rows.set(r.id, r); return out(r);
      },
      async update(id, patch) { const r = rows.get(id); if (!r) return null; r.data = clean({ ...r.data, ...(patch as object) }); r.updatedAt = new Date().toISOString(); return out(r); },
      async delete(id) { return rows.delete(id); },
    };
  };
}
