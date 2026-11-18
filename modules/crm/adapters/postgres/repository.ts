import type pg from 'pg';
import type { CrmRepository } from '../../core/repository';
import type { Activity, Company, Contact, Deal } from '../../core/types';

/** Dépôt PostgreSQL : toutes les valeurs passent par des paramètres ($1, $2…) — jamais de concaténation. */
const TAGS_SQL = `coalesce((SELECT array_agg(t.name::text ORDER BY t.name) FROM contact_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.contact_id = c.id), '{}')`;
const CONTACT_SELECT = `SELECT c.*, ${TAGS_SQL} AS tags FROM contacts c`;
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);

const toContact = (r: any): Contact => ({
  id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone, companyId: r.company_id,
  source: r.source, tags: r.tags ?? [], createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const toCompany = (r: any): Company => ({ id: r.id, name: r.name, website: r.website, phone: r.phone, address: r.address, createdAt: iso(r.created_at) });
const toDeal = (r: any): Deal => ({
  id: r.id, contactId: r.contact_id, title: r.title, stage: r.stage, amount: Number(r.amount),
  expectedClose: r.expected_close ? (r.expected_close instanceof Date ? r.expected_close.toISOString().slice(0, 10) : String(r.expected_close).slice(0, 10)) : null,
  position: r.position, createdAt: iso(r.created_at),
});
const toActivity = (r: any): Activity => ({ id: r.id, contactId: r.contact_id, type: r.type, note: r.note, occurredAt: iso(r.occurred_at) });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un identifiant qui n'est pas un UUID n'existe pas : on répond « introuvable » au lieu de laisser PostgreSQL lever une erreur de type. */
const isId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Colonne SQL ← clé camelCase (liste blanche : jamais de nom de colonne venant de l'extérieur). */
function setClause(patch: Record<string, unknown>, map: Record<string, string>, values: unknown[]) {
  const parts: string[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] === undefined) continue;
    values.push(patch[k]);
    parts.push(`${col} = $${values.length}`);
  }
  return parts;
}

export function postgresRepository(pool: pg.Pool): CrmRepository {
  const setTags = async (client: pg.PoolClient, contactId: string, tags: string[]) => {
    await client.query('DELETE FROM contact_tags WHERE contact_id = $1', [contactId]);
    if (!tags.length) return;
    await client.query('INSERT INTO tags (name) SELECT unnest($1::text[]) ON CONFLICT (name) DO NOTHING', [tags]);
    await client.query('INSERT INTO contact_tags (contact_id, tag_id) SELECT $1, id FROM tags WHERE name = ANY($2::citext[]) ON CONFLICT DO NOTHING', [contactId, tags]);
  };
  const tx = async <T>(fn: (c: pg.PoolClient) => Promise<T>) => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; }
    catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  };
  const getContact = async (id: string) => {
    if (!isId(id)) return null;
    const r = await pool.query(`${CONTACT_SELECT} WHERE c.id = $1`, [id]);
    return r.rows[0] ? toContact(r.rows[0]) : null;
  };

  return {
    contacts: {
      async list(q) {
        const where: string[] = [];
        const v: unknown[] = [];
        if (q.q) { v.push(`%${escapeLike(q.q.toLowerCase())}%`); where.push(`lower(c.first_name || ' ' || c.last_name || ' ' || coalesce(c.email::text, '') || ' ' || c.phone) LIKE $${v.length}`); }
        if (q.companyId) { if (!isId(q.companyId)) return { items: [], total: 0 }; v.push(q.companyId); where.push(`c.company_id = $${v.length}`); }
        if (q.source) { v.push(q.source); where.push(`c.source = $${v.length}`); }
        if (q.tag) { v.push(q.tag); where.push(`EXISTS (SELECT 1 FROM contact_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.contact_id = c.id AND t.name = $${v.length})`); }
        const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const total = await pool.query(`SELECT count(*)::int AS n FROM contacts c ${w}`, v);
        v.push(q.size, (q.page - 1) * q.size);
        const rows = await pool.query(`${CONTACT_SELECT} ${w} ORDER BY c.created_at DESC, c.id LIMIT $${v.length - 1} OFFSET $${v.length}`, v);
        return { items: rows.rows.map(toContact), total: total.rows[0].n };
      },
      get: getContact,
      async findByEmail(email) {
        const r = await pool.query(`${CONTACT_SELECT} WHERE c.email = $1`, [email]);
        return r.rows[0] ? toContact(r.rows[0]) : null;
      },
      async insert(c) {
        const id = await tx(async (client) => {
          const r = await client.query('INSERT INTO contacts (first_name, last_name, email, phone, company_id, source) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [c.firstName, c.lastName, c.email, c.phone, c.companyId, c.source]);
          await setTags(client, r.rows[0].id, c.tags);
          return r.rows[0].id as string;
        });
        return (await getContact(id))!;
      },
      async update(id, patch) {
        if (!isId(id)) return null;
        const ok = await tx(async (client) => {
          const v: unknown[] = [];
          const sets = setClause(patch, { firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', companyId: 'company_id', source: 'source' }, v);
          v.push(id);
          const r = await client.query(`UPDATE contacts SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $${v.length} RETURNING id`, v);
          if (!r.rowCount) return false;
          if (patch.tags) await setTags(client, id, patch.tags);
          return true;
        });
        return ok ? getContact(id) : null;
      },
      async remove(id) { if (!isId(id)) return false; return ((await pool.query('DELETE FROM contacts WHERE id = $1', [id])).rowCount ?? 0) > 0; }, // deals/activities : ON DELETE CASCADE
      async countBySource() {
        const r = await pool.query('SELECT source, count(*)::int AS n FROM contacts GROUP BY source');
        return Object.fromEntries(r.rows.map((x) => [x.source, x.n]));
      },
    },
    companies: {
      async list(q) {
        const v: unknown[] = [];
        let w = '';
        if (q.q) { v.push(`%${escapeLike(q.q.toLowerCase())}%`); w = `WHERE lower(name) LIKE $1`; }
        const total = await pool.query(`SELECT count(*)::int AS n FROM companies ${w}`, v);
        v.push(q.size, (q.page - 1) * q.size);
        const rows = await pool.query(`SELECT * FROM companies ${w} ORDER BY name LIMIT $${v.length - 1} OFFSET $${v.length}`, v);
        return { items: rows.rows.map(toCompany), total: total.rows[0].n };
      },
      async get(id) { if (!isId(id)) return null; const r = await pool.query('SELECT * FROM companies WHERE id = $1', [id]); return r.rows[0] ? toCompany(r.rows[0]) : null; },
      async insert(c) { const r = await pool.query('INSERT INTO companies (name, website, phone, address) VALUES ($1,$2,$3,$4) RETURNING *', [c.name, c.website, c.phone, c.address]); return toCompany(r.rows[0]); },
      async update(id, patch) {
        if (!isId(id)) return null;
        const v: unknown[] = [];
        const sets = setClause(patch, { name: 'name', website: 'website', phone: 'phone', address: 'address' }, v);
        if (!sets.length) return this.get(id);
        v.push(id);
        const r = await pool.query(`UPDATE companies SET ${sets.join(', ')} WHERE id = $${v.length} RETURNING *`, v);
        return r.rows[0] ? toCompany(r.rows[0]) : null;
      },
      async remove(id) { if (!isId(id)) return false; return ((await pool.query('DELETE FROM companies WHERE id = $1', [id])).rowCount ?? 0) > 0; }, // contacts : ON DELETE SET NULL
    },
    deals: {
      async list(f) {
        const where: string[] = []; const v: unknown[] = [];
        if (f.contactId) { if (!isId(f.contactId)) return []; v.push(f.contactId); where.push(`contact_id = $${v.length}`); }
        if (f.stage) { v.push(f.stage); where.push(`stage = $${v.length}`); }
        const r = await pool.query(`SELECT * FROM deals ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY position, created_at, id`, v);
        return r.rows.map(toDeal);
      },
      async get(id) { if (!isId(id)) return null; const r = await pool.query('SELECT * FROM deals WHERE id = $1', [id]); return r.rows[0] ? toDeal(r.rows[0]) : null; },
      async insert(d) { const r = await pool.query('INSERT INTO deals (contact_id, title, stage, amount, expected_close, position) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [d.contactId, d.title, d.stage, d.amount, d.expectedClose, d.position]); return toDeal(r.rows[0]); },
      async update(id, patch) {
        if (!isId(id)) return null;
        const v: unknown[] = [];
        const sets = setClause(patch, { title: 'title', stage: 'stage', amount: 'amount', expectedClose: 'expected_close', position: 'position' }, v);
        if (!sets.length) return this.get(id);
        v.push(id);
        const r = await pool.query(`UPDATE deals SET ${sets.join(', ')} WHERE id = $${v.length} RETURNING *`, v);
        return r.rows[0] ? toDeal(r.rows[0]) : null;
      },
      async remove(id) { if (!isId(id)) return false; return ((await pool.query('DELETE FROM deals WHERE id = $1', [id])).rowCount ?? 0) > 0; },
    },
    activities: {
      async listByContact(contactId) { if (!isId(contactId)) return []; const r = await pool.query('SELECT * FROM activities WHERE contact_id = $1 ORDER BY occurred_at DESC, id DESC', [contactId]); return r.rows.map(toActivity); },
      async insert(a) { const r = await pool.query('INSERT INTO activities (contact_id, type, note, occurred_at) VALUES ($1,$2,$3,$4) RETURNING *', [a.contactId, a.type, a.note, a.occurredAt]); return toActivity(r.rows[0]); },
    },
    tags: { async list() { return (await pool.query('SELECT name::text AS name FROM tags ORDER BY name')).rows.map((r) => r.name); } },
  };
}
