/** Crée le premier administrateur sans données de démonstration (production) :
 *  ADMIN_EMAIL=moi@exemple.tn ADMIN_NAME="Mon Nom" ADMIN_PASSWORD='…' npm run db:create-admin */
import pg from 'pg';
import { LmsService } from '../../core/services';
import { postgresRepository } from './repository';

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (!DATABASE_URL) throw new Error('DATABASE_URL manquant');
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD sont obligatoires');
const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  const lms = new LmsService(postgresRepository(pool));
  const u = await lms.createUser({ id: 'bootstrap', nom: 'Bootstrap', role: 'admin' }, { email: ADMIN_EMAIL, nom: ADMIN_NAME || 'Administrateur', role: 'admin', password: ADMIN_PASSWORD });
  console.log(`✔ Administrateur créé : ${u.email}`);
} finally {
  await pool.end();
}
