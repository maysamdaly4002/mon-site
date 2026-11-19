import pg from 'pg';
import { conflict } from '../../core/errors';
import type { ErpRepository, Table } from '../../core/repository';
import type { JournalEntry } from '../../core/types';

// DATE → 'AAAA-MM-JJ' (jamais d'objet Date : pas de décalage de fuseau) ; TIMESTAMPTZ → ISO UTC (stable pour le hash du registre).
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());

/** Toutes les valeurs passent par des paramètres ($1, $2…) ; les noms de tables/colonnes viennent d'une liste blanche, jamais de l'extérieur. */
type Q = { query(text: string, values?: unknown[]): Promise<{ rows: any[] }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const snake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const isUuidKey = (k: string) => k === 'id' || (k.endsWith('Id') && k !== 'auteurId');

function table<E extends { id: string; createdAt: string }>(q: Q, name: string, keys: string): Table<E> {
  const cols = keys.split(' ');
  const fromRow = (r: any): E => {
    const o: any = { id: r.id, createdAt: r.created_at };
    for (const k of cols) o[k] = r[snake(k)];
    return o;
  };
  const guard = async <T,>(fn: () => Promise<T>) => {
    try { return await fn(); } catch (e: any) { if (e?.code === '23505') throw conflict('Cet enregistrement existe déjà'); throw e; }
  };
  return {
    async get(id) {
      if (!UUID.test(id)) return null; // un identifiant qui n'est pas un UUID n'existe pas
      const r = await q.query(`SELECT * FROM ${name} WHERE id = $1`, [id]);
      return r.rows[0] ? fromRow(r.rows[0]) : null;
    },
    async find(where = {}) {
      const vals: unknown[] = [], conds: string[] = [];
      for (const [k, v] of Object.entries(where)) {
        if (v === undefined) continue;
        if (k !== 'id' && !cols.includes(k)) throw new Error(`Colonne inconnue : ${k}`);
        if (isUuidKey(k) && v !== null && !UUID.test(String(v))) return [];
        if (v === null) conds.push(`${snake(k)} IS NULL`);
        else { vals.push(v); conds.push(`${snake(k)} = $${vals.length}`); }
      }
      const r = await q.query(`SELECT * FROM ${name}${conds.length ? ` WHERE ${conds.join(' AND ')}` : ''} ORDER BY created_at, id`, vals);
      return r.rows.map(fromRow);
    },
    insert: (d) => guard(async () => {
      const use = cols.filter((k) => (d as any)[k] !== undefined);
      const r = await q.query(`INSERT INTO ${name} (${use.map(snake).join(', ')}) VALUES (${use.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, use.map((k) => (d as any)[k]));
      return fromRow(r.rows[0]);
    }),
    update: (id, patch) => guard(async () => {
      const use = cols.filter((k) => (patch as any)[k] !== undefined);
      if (!UUID.test(id)) return null;
      if (!use.length) { const r = await q.query(`SELECT * FROM ${name} WHERE id = $1`, [id]); return r.rows[0] ? fromRow(r.rows[0]) : null; }
      const r = await q.query(`UPDATE ${name} SET ${use.map((k, i) => `${snake(k)} = $${i + 1}`).join(', ')} WHERE id = $${use.length + 1} RETURNING *`, [...use.map((k) => (patch as any)[k]), id]);
      return r.rows[0] ? fromRow(r.rows[0]) : null;
    }),
  };
}

const toEntry = (r: any): JournalEntry => ({
  id: r.id, etablissementId: r.etablissement_id, seq: r.seq, type: r.type, occurredAt: r.occurred_at, auteur: r.auteur,
  payload: r.payload, corrigeId: r.corrige_id, prevHash: r.prev_hash.trim(), hash: r.hash.trim(), createdAt: r.created_at,
});

function build(q: Q, pool: pg.Pool | null): ErpRepository {
  const t = <E extends { id: string; createdAt: string }>(name: string, keys: string) => table<E>(q, name, keys);
  const repo: ErpRepository = {
    etablissements: t('etablissements', 'nom adresse typeActivite categorie effectifMax emailAlertes'),
    batiments: t('batiments', 'etablissementId nom'),
    niveaux: t('niveaux', 'batimentId etablissementId nom ordre'),
    types: t('types_equipement', 'code libelle periodiciteDefautMois'),
    regles: t('regles_periodicite', 'typeEquipementId categorie periodiciteMois'),
    equipements: t('equipements', 'etablissementId niveauId typeId libelle emplacement dateMiseEnService qrCode statut dernierControle prochaineEcheance'),
    controles: t('controles', 'equipementId etablissementId date resultat observations documentId controleur auteurId'),
    nonConformites: t('non_conformites', 'controleId equipementId etablissementId description statut leveeAt leveeNote'),
    actions: t('actions_correctives', 'nonConformiteId etablissementId description responsable echeance statut'),
    exercices: t('exercices', 'etablissementId type date participants dureeMin observations recyclageMois prochainRecyclage'),
    documents: t('documents', 'etablissementId nom mime taille sha256 contenu'),
    visites: t('visites_commission', 'etablissementId date avis president observations prochaineVisite'),
    prescriptions: t('prescriptions', 'visiteId etablissementId description responsable echeance statut leveeAt'),
    plans: t('plans_etage', 'etablissementId niveauId nom documentId'),
    positions: t('positions_plan', 'planId equipementId etablissementId x y'),
    users: t('users', 'email nom role passwordHash'),
    acces: t('acces', 'userId etablissementId'),
    alertes: t('alertes_envoyees', 'cle'),
    journal: {
      /** Verrou consultatif par établissement + UNIQUE (etablissement_id, seq) : deux écritures simultanées ne peuvent pas forker la chaîne. */
      async append(etablissementId, buildEntry) {
        const run = async (c: Q) => {
          await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [etablissementId]);
          const last = (await c.query('SELECT * FROM journal_registre WHERE etablissement_id = $1 ORDER BY seq DESC LIMIT 1', [etablissementId])).rows[0];
          const e = buildEntry(last ? toEntry(last) : null);
          const r = await c.query(
            'INSERT INTO journal_registre (etablissement_id, seq, type, occurred_at, auteur, payload, corrige_id, prev_hash, hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
            [e.etablissementId, e.seq, e.type, e.occurredAt, e.auteur, JSON.stringify(e.payload), e.corrigeId, e.prevHash, e.hash]);
          return toEntry(r.rows[0]);
        };
        if (!pool) return run(q); // déjà dans une transaction (verrou libéré au COMMIT)
        const c = await pool.connect();
        try { await c.query('BEGIN'); const out = await run(c); await c.query('COMMIT'); return out; }
        catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      },
      async list(etablissementId) {
        if (!UUID.test(etablissementId)) return [];
        return (await q.query('SELECT * FROM journal_registre WHERE etablissement_id = $1 ORDER BY seq', [etablissementId])).rows.map(toEntry);
      },
      async get(id) {
        if (!UUID.test(id)) return null;
        const r = await q.query('SELECT * FROM journal_registre WHERE id = $1', [id]);
        return r.rows[0] ? toEntry(r.rows[0]) : null;
      },
    },
    async transaction(fn) {
      if (!pool) return fn(repo); // déjà dans une transaction
      const c = await pool.connect();
      try { await c.query('BEGIN'); const out = await fn(build(c, null)); await c.query('COMMIT'); return out; }
      catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    },
  };
  return repo;
}

export const postgresRepository = (pool: pg.Pool): ErpRepository => build(pool, pool);
