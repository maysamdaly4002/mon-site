import pg from 'pg';
import { ErpService } from '../../core/services';
import { isoDay } from '../../core/dates';
import { seedDemo, DEMO_PASSWORD } from '../../seed/demo';
import { postgresRepository } from './repository';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const erp = new ErpService(postgresRepository(pool));
const admin = { id: 'seed', nom: 'Seed', role: 'admin', etablissementIds: '*' } as const;
if ((await erp.listEtablissements(admin)).length > 0) console.log('Base déjà peuplée : seed ignoré.');
else {
  const r = await seedDemo(erp, admin, isoDay(new Date()));
  console.log(`✔ Données de démonstration : 2 établissements, ${r.equipements} équipements.`);
  console.log(`  Comptes : admin@demo.tn · exploitant@demo.tn · technicien@demo.tn · auditeur@demo.tn  (mot de passe : ${DEMO_PASSWORD})`);
}
await pool.end();
