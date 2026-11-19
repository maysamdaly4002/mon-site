import type { ErpRepository, Table } from '../../core/repository';
import type { JournalEntry } from '../../core/types';

/**
 * Dépôt pour les collections Snapify (`ctx.db.collection(name)` → table module_records, JSONB).
 * Interface minimale recopiée du modèle CRM : le cœur n'importe rien du CMS.
 * ⚠ Les collections n'ont ni transactions ni contrainte UNIQUE : toutes les écritures passent par `ctx.lock('erp', …)`
 *   (voir src/server.ts), ce qui sérialise aussi l'ajout au registre (pas de fourche de chaîne).
 */
export interface CollectionLike<T> {
  get(id: string): Promise<(T & Meta) | null>;
  find(q?: {
    where?: Record<string, unknown>;
    filters?: { field: string; op: 'eq' | 'ne' | 'in' | 'contains'; value: unknown }[];
    search?: { text: string; fields: string[] };
    limit?: number; offset?: number; orderBy?: { field: string; dir: 'asc' | 'desc'; numeric?: boolean }[] }): Promise<{ items: (T & Meta)[]; total: number }>;
  findOne(where: Record<string, unknown>): Promise<(T & Meta) | null>;
  insert(data: T): Promise<T & Meta>;
  update(id: string, patch: Partial<T>): Promise<(T & Meta) | null>;
  delete(id: string): Promise<boolean>;
}
interface Meta { id: string; createdAt: string; updatedAt: string }
export type CollectionFactory = <T>(name: string) => CollectionLike<T>;

/** Parcourt toute une collection par pages de 500 (limite du CMS). */
async function all<T>(c: CollectionLike<T>, where?: Record<string, unknown>) {
  const out: (T & Meta)[] = [];
  for (let offset = 0; ; offset += 500) {
    const { items, total } = await c.find({ where, limit: 500, offset });
    out.push(...items);
    if (offset + 500 >= total) return out;
  }
}
const noMeta = <E,>(r: any): E => { const { updatedAt: _u, ...rest } = r; return rest as E; };

function table<E extends { id: string; createdAt: string }>(c: CollectionLike<any>): Table<E> {
  return {
    async get(id) { const r = await c.get(id); return r ? noMeta<E>(r) : null; },
    async find(where = {}) {
      const w = Object.fromEntries(Object.entries(where).filter(([, v]) => v !== undefined));
      return (await all(c, w)).map((r) => noMeta<E>(r)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    },
    async insert(d) { return noMeta<E>(await c.insert(d as any)); },
    async update(id, patch) { const r = await c.update(id, patch as any); return r ? noMeta<E>(r) : null; },
  };
}

export function snapifyRepository(collection: CollectionFactory): ErpRepository {
  const t = <E extends { id: string; createdAt: string }>(name: string) => table<E>(collection(name));
  const journal = collection<Omit<JournalEntry, 'id' | 'createdAt'>>('journal_registre');
  const repo: ErpRepository = {
    etablissements: t('etablissements'), batiments: t('batiments'), niveaux: t('niveaux'), types: t('types_equipement'), regles: t('regles_periodicite'),
    equipements: t('equipements'), controles: t('controles'), nonConformites: t('non_conformites'), actions: t('actions_correctives'),
    exercices: t('exercices'), documents: t('documents'), visites: t('visites_commission'), prescriptions: t('prescriptions'), plans: t('plans_etage'), positions: t('positions_plan'), users: t('users'), acces: t('acces'), alertes: t('alertes_envoyees'),
    journal: {
      async append(etablissementId, build) {
        const list = await this.list(etablissementId);
        return noMeta<JournalEntry>(await journal.insert(build(list.at(-1) ?? null)));
      },
      async list(etablissementId) { return (await all(journal, { etablissementId })).map((r) => noMeta<JournalEntry>(r)).sort((a, b) => a.seq - b.seq); },
      async get(id) { const r = await journal.get(id); return r ? noMeta<JournalEntry>(r) : null; },
    },
    async transaction(fn) { return fn(repo); },
  };
  return repo;
}
