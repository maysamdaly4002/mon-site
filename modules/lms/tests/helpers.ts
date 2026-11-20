import { after } from 'node:test';
import pg from 'pg';
import { LmsService, type ServiceOptions } from '../core/services';
import { memoryRepository } from '../core/memory';
import { postgresRepository } from '../adapters/postgres/repository';
import { migrate } from '../adapters/postgres/migrate';
import { snapifyRepository } from '../adapters/snapify/repository';
import { fakeCollections } from './fake-collections';
import type { Actor, Role } from '../core/types';

export const admin: Actor = { id: 'u-admin', nom: 'Admin', role: 'admin' };
export const actor = (role: Role, id = `u-${role}`, nom: string = role): Actor => ({ id, nom, role });

/** Par défaut : dépôt en mémoire. TEST_DATABASE_URL : PostgreSQL. TEST_BACKEND=snapify : collections Snapify simulées. */
let pool: pg.Pool | null = null;
if (process.env.TEST_DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  after(() => pool!.end());
}
export async function makeService(opts: ServiceOptions = {}) {
  const o = { jwtSecret: 'test-secret', ...opts };
  if (process.env.TEST_BACKEND === 'snapify') return new LmsService(snapifyRepository(fakeCollections()), o);
  if (!pool) return new LmsService(memoryRepository(), o);
  await migrate(pool);
  await pool.query('TRUNCATE certificats, tentatives, progressions, enrollments, questions, quizzes, lessons, chapters, courses, users RESTART IDENTITY CASCADE');
  return new LmsService(postgresRepository(pool), o);
}
/** Horloge contrôlable. */
export const clock = (iso: string) => { let t = new Date(`${iso}T09:00:00Z`); return { now: () => t, set: (d: string) => { t = new Date(`${d}T09:00:00Z`); } }; };
