import crypto from 'node:crypto';
import type { ErpRepository, Table } from './repository';
import type { JournalEntry } from './types';

function table<E extends { id: string; createdAt: string }>(): Table<E> {
  const rows = new Map<string, E>();
  return {
    async get(id) { return rows.get(id) ?? null; },
    async find(where = {}) {
      return [...rows.values()].filter((r) => Object.entries(where).every(([k, v]) => (r as any)[k] === v)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async insert(d) { const r = { ...d, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as unknown as E; rows.set(r.id, r); return r; },
    async update(id, patch) { const r = rows.get(id); if (!r) return null; const n = { ...r, ...patch }; rows.set(id, n); return n; },
  };
}

/** Dépôt en mémoire (tests). */
export function memoryRepository(): ErpRepository {
  const entries: JournalEntry[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  const repo: ErpRepository = {
    etablissements: table(), batiments: table(), niveaux: table(), types: table(), regles: table(), equipements: table(),
    controles: table(), nonConformites: table(), actions: table(), exercices: table(), documents: table(), visites: table(), prescriptions: table(), plans: table(), positions: table(), users: table(),
    acces: table(), alertes: table(),
    journal: {
      append(etablissementId, build) {
        const run = chain.then(() => {
          const mine = entries.filter((e) => e.etablissementId === etablissementId);
          const e = { ...build(mine.at(-1) ?? null), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
          entries.push(e);
          return e;
        });
        chain = run.catch(() => undefined);
        return run;
      },
      async list(etablissementId) { return entries.filter((e) => e.etablissementId === etablissementId).sort((a, b) => a.seq - b.seq); },
      async get(id) { return entries.find((e) => e.id === id) ?? null; },
    },
    async transaction(fn) { return fn(repo); },
  };
  return repo;
}
