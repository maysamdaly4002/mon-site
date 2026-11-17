/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Collections d'enregistrements des modules (`ctx.db.collection()`) : documents JSON dans
 * `module_records`, isolés par module et par collection. Les filtres sont traduits en SQL
 * paramétré ; seuls des noms de champs simples sont acceptés.
 */
import crypto from 'crypto';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { moduleRecords } from '../db/schema';
import type { Collection, FindQuery, RecordFilter, StoredRecord } from '../../sdk/index';

const COLLECTION_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_RECORD_BYTES = 256 * 1024;
const MAX_RECORDS_PER_COLLECTION = 100_000;
const META = { id: moduleRecords.id, createdAt: moduleRecords.createdAt, updatedAt: moduleRecords.updatedAt } as const;

const ACCENTS_FROM = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
const ACCENTS_TO = 'aaaaaaceeeeiiiinooooouuuuyy';
export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

type Row = typeof moduleRecords.$inferSelect;

function toRecord<T>(row: Row): StoredRecord<T> {
  return { ...(row.data as T), id: row.id, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function fieldExpr(field: string, numeric = false): SQL {
  if (field in META) return sql`${META[field as keyof typeof META]}`;
  if (!FIELD_PATTERN.test(field)) throw new Error(`champ invalide : ${field}`);
  return numeric ? sql`(${moduleRecords.data}->>${field})::numeric` : sql`(${moduleRecords.data}->>${field})`;
}

function filterSql(f: RecordFilter): SQL {
  const numeric = typeof f.value === 'number';
  const col = fieldExpr(f.field, numeric);
  const v = f.value;
  switch (f.op) {
    case 'eq':
      return f.field in META ? sql`${col} = ${v}` : sql`${moduleRecords.data} @> ${JSON.stringify({ [f.field]: v })}::jsonb`;
    case 'ne':
      return sql`(${col} IS DISTINCT FROM ${numeric ? v : String(v)})`;
    case 'gt':
      return sql`${col} > ${v}`;
    case 'gte':
      return sql`${col} >= ${v}`;
    case 'lt':
      return sql`${col} < ${v}`;
    case 'lte':
      return sql`${col} <= ${v}`;
    case 'in': {
      const list = Array.isArray(v) ? v.slice(0, 500).map(String) : [];
      if (!list.length) return sql`false`;
      return sql`${fieldExpr(f.field)} IN (${sql.join(list.map((x) => sql`${x}`), sql`, `)})`;
    }
    case 'contains':
      return sql`${moduleRecords.data} @> ${JSON.stringify({ [f.field]: [v] })}::jsonb`;
    case 'exists':
      return v === false ? sql`NOT (${moduleRecords.data} ? ${f.field})` : sql`${moduleRecords.data} ? ${f.field}`;
    default:
      throw new Error(`opérateur inconnu : ${String(f.op)}`);
  }
}

function whereSql(moduleId: string, collection: string, q: Pick<FindQuery, 'where' | 'filters' | 'search'> = {}): SQL {
  const parts: SQL[] = [eq(moduleRecords.moduleId, moduleId), eq(moduleRecords.collection, collection)];
  if (q.where && Object.keys(q.where).length) {
    for (const k of Object.keys(q.where)) if (!FIELD_PATTERN.test(k)) throw new Error(`champ invalide : ${k}`);
    parts.push(sql`${moduleRecords.data} @> ${JSON.stringify(q.where)}::jsonb`);
  }
  for (const f of q.filters ?? []) parts.push(filterSql(f));
  const text = q.search?.text ? fold(q.search.text.trim()).slice(0, 100) : '';
  if (text && q.search?.fields.length) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const ors = q.search.fields.slice(0, 10).map((f) => sql`translate(lower(coalesce(${fieldExpr(f)}, '')), ${ACCENTS_FROM}, ${ACCENTS_TO}) LIKE ${like}`);
    parts.push(sql`(${sql.join(ors, sql` OR `)})`);
  }
  return and(...parts)!;
}

function serialize(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('un enregistrement doit être un objet');
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data as Record<string, unknown>;
  const json = JSON.stringify(rest);
  if (Buffer.byteLength(json) > MAX_RECORD_BYTES) throw new Error('enregistrement trop volumineux (256 Ko max.)');
  return JSON.parse(json);
}

export function createCollection<T>(moduleId: string, name: string): Collection<T> {
  if (!COLLECTION_PATTERN.test(name)) throw new Error(`[module:${moduleId}] nom de collection invalide : ${name}`);
  const scope = and(eq(moduleRecords.moduleId, moduleId), eq(moduleRecords.collection, name))!;
  const byId = (id: string) => and(scope, eq(moduleRecords.id, id))!;
  const validId = (id: unknown): id is string => typeof id === 'string' && ID_PATTERN.test(id);

  const find: Collection<T>['find'] = async (q = {}) => {
    const where = whereSql(moduleId, name, q);
    const limit = Math.min(500, Math.max(1, Math.floor(q.limit ?? 100)));
    const offset = Math.max(0, Math.floor(q.offset ?? 0));
    const order = (q.orderBy?.length ? q.orderBy : [{ field: 'createdAt', dir: 'desc' as const }])
      .slice(0, 3)
      .map((o) => (o.dir === 'asc' ? sql`${fieldExpr(o.field, o.numeric)} ASC NULLS LAST` : sql`${fieldExpr(o.field, o.numeric)} DESC NULLS LAST`));
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(moduleRecords).where(where).orderBy(...order, sql`${moduleRecords.id}`).limit(limit).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(moduleRecords).where(where),
    ]);
    return { items: rows.map((r) => toRecord<T>(r)), total };
  };

  return {
    async get(id) {
      if (!validId(id)) return null;
      const [row] = await db.select().from(moduleRecords).where(byId(id));
      return row ? toRecord<T>(row) : null;
    },
    async getMany(ids) {
      const list = [...new Set(ids.filter(validId))].slice(0, 500);
      if (!list.length) return [];
      const rows = await db.select().from(moduleRecords).where(and(scope, inArray(moduleRecords.id, list)));
      const map = new Map(rows.map((r) => [r.id, toRecord<T>(r)]));
      return list.map((id) => map.get(id)).filter((r): r is StoredRecord<T> => !!r);
    },
    find,
    async findOne(where) {
      const { items } = await find({ where, limit: 1 });
      return items[0] ?? null;
    },
    async count(q = {}) {
      const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(moduleRecords).where(whereSql(moduleId, name, q));
      return total;
    },
    async insert(data, opts = {}) {
      const id = opts.id ?? crypto.randomBytes(9).toString('base64url');
      if (!validId(id)) throw new Error('identifiant d’enregistrement invalide');
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(moduleRecords).where(scope);
      if (n >= MAX_RECORDS_PER_COLLECTION) throw new Error(`collection ${name} pleine (${MAX_RECORDS_PER_COLLECTION} enregistrements)`);
      const now = new Date();
      const [row] = await db
        .insert(moduleRecords)
        .values({ moduleId, collection: name, id, data: serialize(data), createdAt: now, updatedAt: now })
        .returning();
      return toRecord<T>(row);
    },
    async update(id, patch) {
      if (!validId(id)) return null;
      const [current] = await db.select().from(moduleRecords).where(byId(id));
      if (!current) return null;
      const data = serialize({ ...(current.data as object), ...(patch as object) });
      const [row] = await db.update(moduleRecords).set({ data, updatedAt: new Date() }).where(byId(id)).returning();
      return row ? toRecord<T>(row) : null;
    },
    async delete(id) {
      if (!validId(id)) return false;
      const rows = await db.delete(moduleRecords).where(byId(id)).returning({ id: moduleRecords.id });
      return rows.length > 0;
    },
  };
}

export async function deleteModuleRecords(moduleId: string) {
  await db.delete(moduleRecords).where(eq(moduleRecords.moduleId, moduleId));
}
