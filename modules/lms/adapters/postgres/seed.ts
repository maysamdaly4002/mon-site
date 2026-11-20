import pg from 'pg';
import { LmsService } from '../../core/services';
import { seedDemo, DEMO_PASSWORD } from '../../seed/demo';
import { postgresRepository } from './repository';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const lms = new LmsService(postgresRepository(pool));
const admin = { id: 'seed', nom: 'Seed', role: 'admin' } as const;
if ((await lms.listCourses(admin)).length > 0) console.log('Base déjà peuplée : seed ignoré.');
else {
  await lms.createUser(admin, { email: 'admin@demo.tn', nom: 'Administrateur', role: 'admin', password: DEMO_PASSWORD });
  await seedDemo(lms, admin);
  console.log('✔ Données de démonstration : 3 cours, 5 comptes, inscriptions et 1 certificat.');
  console.log(`  Comptes : admin@demo.tn · instructeur@demo.tn · apprenant@demo.tn · sami@demo.tn · auditeur@demo.tn  (mot de passe : ${DEMO_PASSWORD})`);
}
await pool.end();
