import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { admin, clock, makeService } from './helpers';
import { verifyChain } from '../core/registre';
import { postgresRepository } from '../adapters/postgres/repository';

/** Garanties propres à PostgreSQL (ignorées sans TEST_DATABASE_URL). */
const url = process.env.TEST_DATABASE_URL;
const pgTest = url ? test : test.skip;

async function seeded() {
  const erp = await makeService({ now: clock('2026-11-19').now });
  const t = await erp.createType(admin, { code: 'ext', libelle: 'Extincteur', periodiciteDefautMois: 12 });
  const et = await erp.createEtablissement(admin, { nom: 'PG', typeActivite: 'Hôtel', categorie: '3', effectifMax: 10, adresse: '' });
  const eq = await erp.createEquipement(admin, { etablissementId: et.id, typeId: t.id, libelle: 'E', dateMiseEnService: '2026-01-01' });
  return { erp, et, eq };
}

pgTest('registre : le trigger PostgreSQL refuse UPDATE et DELETE, même en SQL direct', async () => {
  const { erp, et, eq } = await seeded();
  await erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-01', resultat: 'conforme', controleur: 'Sami' });
  const pool = new pg.Pool({ connectionString: url });
  try {
    await assert.rejects(pool.query(`UPDATE journal_registre SET auteur = 'pirate' WHERE etablissement_id = $1`, [et.id]), /ajout seul/);
    await assert.rejects(pool.query('DELETE FROM journal_registre WHERE etablissement_id = $1', [et.id]), /ajout seul/);
    assert.equal((await erp.listRegistre(admin, { etablissementId: et.id })).total, 1);
  } finally { await pool.end(); }
});

pgTest('registre : un administrateur de base qui contourne le trigger est tout de même détecté par la chaîne de hachage', async () => {
  const { erp, et, eq } = await seeded();
  for (const d of ['2026-10-01', '2026-10-15', '2026-11-01']) await erp.recordControle(admin, { equipementId: eq.id, date: d, resultat: 'conforme', controleur: 'Sami' });
  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query('ALTER TABLE journal_registre DISABLE TRIGGER journal_registre_no_update'); // attaque : droits de propriétaire
    await pool.query(`UPDATE journal_registre SET payload = jsonb_set(payload, '{resultat}', '"non_conforme"') WHERE etablissement_id = $1 AND seq = 2`, [et.id]);
    await pool.query('ALTER TABLE journal_registre ENABLE TRIGGER journal_registre_no_update');
    const check = await erp.verifyRegistre(admin, et.id);
    assert.equal(check.ok, false);
    assert.equal(check.brokenAt, 2);
    assert.match(check.reason!, /hash invalide/);
  } finally { await pool.end(); }
});

pgTest('registre : 20 contrôles simultanés ne fourchent pas la chaîne (verrou + UNIQUE seq)', async () => {
  const { erp, et, eq } = await seeded();
  await Promise.all(Array.from({ length: 20 }, (_, i) => erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-01', resultat: 'conforme', controleur: `Contrôleur ${i}` })));
  const pool = new pg.Pool({ connectionString: url });
  try {
    const entries = await postgresRepository(pool).journal.list(et.id);
    assert.deepEqual(entries.map((e) => e.seq), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.deepEqual(verifyChain(entries), { ok: true, checked: 20 });
  } finally { await pool.end(); }
});

pgTest('transaction : si le registre échoue, le contrôle n’est pas enregistré (tout ou rien)', async () => {
  const { erp, et, eq } = await seeded();
  const repo = (erp as any).repo;
  const tx = repo.transaction.bind(repo);
  // La transaction travaille sur son propre dépôt (connexion dédiée) : c'est lui qu'on fait échouer, après l'insertion du contrôle.
  repo.transaction = (fn: (r: any) => Promise<unknown>) => tx((r: any) => { r.journal.append = async () => { throw new Error('panne simulée'); }; return fn(r); });
  await assert.rejects(erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-01', resultat: 'conforme', controleur: 'Sami' }), /panne simulée/);
  repo.transaction = tx;
  assert.equal((await erp.listControles(admin, { etablissementId: et.id })).total, 0);
});

pgTest('injection SQL : les valeurs hostiles sont traitées comme des données', async () => {
  const { erp } = await seeded();
  const hostile = "'; DROP TABLE equipements; --";
  assert.equal((await erp.listEquipements(admin, { q: hostile })).total, 0);
  await assert.rejects(erp.getEtablissement(admin, hostile), /introuvable|Identifiant/);
  const e = await erp.createEtablissement(admin, { nom: hostile, typeActivite: "Robert'); --", categorie: '5', effectifMax: 1, adresse: '' });
  assert.equal(e.nom, hostile);
  assert.ok((await erp.listEquipements(admin)).total >= 1, 'la table existe toujours');
});

pgTest('commission et plans : contraintes SQL (prescription levée ⇔ date de levée, position x/y cohérente, un plan par niveau)', async () => {
  const { erp, et, eq } = await seeded();
  const { prescriptions } = await erp.addVisite(admin, { etablissementId: et.id, date: '2026-11-01', avis: 'favorable', prescriptions: [{ description: 'P', responsable: 'R', echeance: '2026-12-01' }] });
  const bat = await erp.addBatiment(admin, { etablissementId: et.id, nom: 'B' });
  const niv = await erp.addNiveau(admin, { batimentId: bat.id, nom: 'RDC', ordre: 0 });
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const plan = await erp.savePlan(admin, { etablissementId: et.id, niveauId: niv.id, image: { nom: 'p.png', mime: 'image/png', base64: PNG } });
  const pool = new pg.Pool({ connectionString: url });
  try {
    await assert.rejects(pool.query(`UPDATE prescriptions SET statut = 'levee' WHERE id = $1`, [prescriptions[0].id]), /check/i);
    await assert.rejects(pool.query(`INSERT INTO positions_plan (plan_id, equipement_id, etablissement_id, x, y) VALUES ($1,$2,$3,10,NULL)`, [plan.id, eq.id, et.id]), /check/i);
    await assert.rejects(pool.query(`INSERT INTO positions_plan (plan_id, equipement_id, etablissement_id, x, y) VALUES ($1,$2,$3,150,10)`, [plan.id, eq.id, et.id]), /check/i);
    await assert.rejects(pool.query(`INSERT INTO plans_etage (etablissement_id, niveau_id, nom, document_id) VALUES ($1,$2,'doublon',$3)`, [et.id, niv.id, plan.documentId]), /unique/i);
    await assert.rejects(pool.query(`INSERT INTO visites_commission (etablissement_id, date, avis, prochaine_visite) VALUES ($1,'2026-11-01','favorable','2026-10-01')`, [et.id]), /check/i);
  } finally { await pool.end(); }
  assert.equal((await erp.listRegistre(admin, { etablissementId: et.id })).integrity.ok, true);
});
