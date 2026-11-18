import pg from 'pg';
import { CrmService } from '../../core/services';
import { seedDemo } from '../../seed/demo';
import { postgresRepository } from './repository';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const crm = new CrmService(postgresRepository(pool));
if ((await crm.listContacts({ size: 1 })).total > 0) console.log('Base déjà peuplée : seed ignoré.');
else { await seedDemo(crm); console.log('✔ Données de démonstration créées.'); }
await pool.end();
