import pg from 'pg';
import { conflict } from '../../core/errors';
import type { LmsRepository, Table } from '../../core/repository';

// DATE → 'AAAA-MM-JJ' ; TIMESTAMPTZ → ISO UTC (stable : le hash du certificat en dépend).
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());

/** Toutes les valeurs passent par des paramètres ($1, $2…) ; les noms de tables/colonnes viennent d'une liste blanche, jamais de l'extérieur. */
type Q = { query(text: string, values?: unknown[]): Promise<{ rows: any[] }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const snake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
/** Identifiants de personnes : texte libre (UUID d'utilisateur, identifiant du CMS ou « inv_… »), pas des UUID de ligne. */
const TEXT_IDS = new Set(['apprenantId', 'instructeurId']);
const isUuidKey = (k: string) => k === 'id' || (k.endsWith('Id') && !TEXT_IDS.has(k));
const JSON_KEYS = new Set(['choix', 'bonnes', 'reponses', 'medias']);
const ser = (k: string, v: unknown) => (JSON_KEYS.has(k) && v !== null && v !== undefined ? JSON.stringify(v) : v);

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
      const r = await q.query(`INSERT INTO ${name} (${use.map(snake).join(', ')}) VALUES (${use.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, use.map((k) => ser(k, (d as any)[k])));
      return fromRow(r.rows[0]);
    }),
    update: (id, patch) => guard(async () => {
      const use = cols.filter((k) => (patch as any)[k] !== undefined);
      if (!UUID.test(id)) return null;
      if (!use.length) { const r = await q.query(`SELECT * FROM ${name} WHERE id = $1`, [id]); return r.rows[0] ? fromRow(r.rows[0]) : null; }
      const r = await q.query(`UPDATE ${name} SET ${use.map((k, i) => `${snake(k)} = $${i + 1}`).join(', ')} WHERE id = $${use.length + 1} RETURNING *`, [...use.map((k) => ser(k, (patch as any)[k])), id]);
      return r.rows[0] ? fromRow(r.rows[0]) : null;
    }),
  };
}

function build(q: Q, pool: pg.Pool | null): LmsRepository {
  const t = <E extends { id: string; createdAt: string }>(name: string, keys: string) => table<E>(q, name, keys);
  const repo: LmsRepository = {
    users: t('users', 'email nom role passwordHash'),
    courses: t('courses', 'titre description niveau statut instructeurId instructeurNom'),
    chapters: t('chapters', 'courseId titre position archive'),
    lessons: t('lessons', 'courseId chapterId titre type contenu medias dureeMin position archive'),
    quizzes: t('quizzes', 'courseId titre seuil tentativesMax'),
    questions: t('questions', 'quizId courseId enonce choix bonnes position archive'),
    enrollments: t('enrollments', 'courseId apprenantId apprenantNom apprenantEmail inscritPar inscritAt statut termineAt'),
    progressions: t('progressions', 'enrollmentId courseId apprenantId lessonId faitAt saisiPar'),
    tentatives: t('tentatives', 'quizId courseId enrollmentId apprenantId numero passeAt score reussi reponses'),
    certificats: t('certificats', 'courseId apprenantId apprenantNom coursTitre code delivreAt hash'),
    async transaction(fn) {
      if (!pool) return fn(repo); // déjà dans une transaction
      const c = await pool.connect();
      try { await c.query('BEGIN'); const out = await fn(build(c, null)); await c.query('COMMIT'); return out; }
      catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    },
  };
  return repo;
}

export const postgresRepository = (pool: pg.Pool): LmsRepository => build(pool, pool);
