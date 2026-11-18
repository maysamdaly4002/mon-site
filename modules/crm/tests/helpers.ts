import { after } from 'node:test';
import pg from 'pg';
import { CrmService } from '../core/services';
import { memoryRepository } from '../core/memory';
import { postgresRepository } from '../adapters/postgres/repository';
import { migrate } from '../adapters/postgres/migrate';
import { snapifyRepository } from '../adapters/snapify/repository';
import { fakeCollections } from './fake-collections';

/** Par défaut : dépôt en mémoire. TEST_DATABASE_URL : PostgreSQL. TEST_BACKEND=snapify : adaptateur Snapify (collections simulées). */
let pool: pg.Pool | null = null;
if (process.env.TEST_DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
  after(() => pool!.end());
}
export async function makeService() {
  if (process.env.TEST_BACKEND === 'snapify') return new CrmService(snapifyRepository(fakeCollections()));
  if (!pool) return new CrmService(memoryRepository());
  await migrate(pool);
  await pool.query('TRUNCATE contact_tags, tags, activities, deals, contacts, companies RESTART IDENTITY CASCADE');
  return new CrmService(postgresRepository(pool));
}
