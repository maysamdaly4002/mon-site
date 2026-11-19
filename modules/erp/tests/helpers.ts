import { after } from 'node:test';
import pg from 'pg';
import { ErpService, type ServiceOptions } from '../core/services';
import { memoryRepository } from '../core/memory';
import { postgresRepository } from '../adapters/postgres/repository';
import { migrate } from '../adapters/postgres/migrate';
import { snapifyRepository } from '../adapters/snapify/repository';
import { fakeCollections } from './fake-collections';
import type { Actor } from '../core/types';

export const admin: Actor = { id: 'u-admin', nom: 'Admin', role: 'admin', etablissementIds: '*' };
export const actor = (role: Actor['role'], etablissementIds: string[] | '*' = '*', nom = role): Actor => ({ id: `u-${nom}`, nom, role, etablissementIds });

/** Par défaut : dépôt en mémoire. TEST_DATABASE_URL : PostgreSQL. TEST_BACKEND=snapify : collections Snapify simulées. */
let pool: pg.Pool | null = null;
if (process.env.TEST_DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  after(() => pool!.end());
}
export async function makeService(opts: ServiceOptions = {}) {
  const o = { jwtSecret: 'test-secret', ...opts };
  if (process.env.TEST_BACKEND === 'snapify') return new ErpService(snapifyRepository(fakeCollections()), o);
  if (!pool) return new ErpService(memoryRepository(), o);
  await migrate(pool);
  await pool.query('TRUNCATE journal_registre, alertes_envoyees, positions_plan, plans_etage, prescriptions, visites_commission, acces, users, documents, exercices, actions_correctives, non_conformites, controles, equipements, regles_periodicite, types_equipement, niveaux, batiments, etablissements RESTART IDENTITY CASCADE');
  return new ErpService(postgresRepository(pool), o);
}
/** Horloge contrôlable. */
export const clock = (iso: string) => { let t = new Date(`${iso}T09:00:00Z`); return { now: () => t, set: (d: string) => { t = new Date(`${d}T09:00:00Z`); } }; };
