import crypto from 'node:crypto';
import type { LmsRepository, Table } from './repository';

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
export function memoryRepository(): LmsRepository {
  const repo: LmsRepository = {
    users: table(), courses: table(), chapters: table(), lessons: table(), quizzes: table(), questions: table(),
    enrollments: table(), progressions: table(), tentatives: table(), certificats: table(),
    async transaction(fn) { return fn(repo); },
  };
  return repo;
}
