import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actor, admin, clock, makeService } from './helpers';
import { ErpError } from '../core/errors';
import { addMonths } from '../core/dates';
import { verifyChain } from '../core/registre';
import { verifyToken } from '../core/auth';
import type { Mailer } from '../core/services';
import type { Actor } from '../core/types';

const rejects = (p: Promise<unknown>, code: ErpError['code']) => assert.rejects(p, (e: unknown) => e instanceof ErpError && e.code === code);
const TODAY = '2026-11-19';

/** Un établissement de catégorie 3 avec un type « extincteur » (12 mois) et un type « désenfumage » (12 mois, 6 mois en cat. 1-2). */
async function setup(opts: Parameters<typeof makeService>[0] = {}) {
  const c = clock(TODAY);
  const erp = await makeService({ now: c.now, ...opts });
  const ext = await erp.createType(admin, { code: 'extincteur', libelle: 'Extincteur', periodiciteDefautMois: 12 });
  const des = await erp.createType(admin, { code: 'desenfumage', libelle: 'Désenfumage', periodiciteDefautMois: 12 });
  await erp.setRule(admin, { typeEquipementId: des.id, categorie: '1', periodiciteMois: 6 });
  const et = await erp.createEtablissement(admin, { nom: 'Hôtel Test', adresse: 'Tunis', typeActivite: 'Hôtel', categorie: '3', effectifMax: 200, emailAlertes: 'sec@test.tn' });
  const eq = await erp.createEquipement(admin, { etablissementId: et.id, typeId: ext.id, libelle: 'Extincteur RDC', emplacement: 'Hall', dateMiseEnService: '2026-01-15' });
  return { erp, c, ext, des, et, eq };
}

test('échéance : mise en service + périodicité, fin de mois ramenée au dernier jour', async () => {
  const { eq } = await setup();
  assert.equal(eq.prochaineEcheance, '2027-01-15');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
});

test('périodicité : la règle de la catégorie l’emporte, et un changement de règle recalcule les échéances', async () => {
  const { erp, des, et } = await setup();
  const d3 = await erp.createEquipement(admin, { etablissementId: et.id, typeId: des.id, libelle: 'Désenfumage', dateMiseEnService: '2026-03-01' });
  assert.equal(d3.prochaineEcheance, '2027-03-01', 'catégorie 3 : valeur par défaut (12 mois)');
  await erp.updateEtablissement(admin, et.id, { categorie: '1' });
  assert.equal((await erp.getEquipement(admin, d3.id)).equipement.prochaineEcheance, '2026-09-01', 'catégorie 1 : règle de 6 mois');
  const r = await erp.setRule(admin, { typeEquipementId: des.id, categorie: '1', periodiciteMois: 4 });
  assert.equal(r.recalculated, 1);
  assert.equal((await erp.getEquipement(admin, d3.id)).equipement.prochaineEcheance, '2026-07-01');
});

test('contrôle conforme : échéance repoussée ; un contrôle antidaté ne fait pas reculer la date du dernier contrôle', async () => {
  const { erp, eq } = await setup();
  const r = await erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-10', resultat: 'conforme', controleur: 'Sami Trabelsi' });
  assert.equal(r.equipement.prochaineEcheance, '2027-11-10');
  assert.equal(r.nonConformite, null);
  const old = await erp.recordControle(admin, { equipementId: eq.id, date: '2026-06-01', resultat: 'conforme', controleur: 'Sami Trabelsi' });
  assert.equal(old.equipement.dernierControle, '2026-11-10');
  await rejects(erp.recordControle(admin, { equipementId: eq.id, date: '2026-12-25', resultat: 'conforme', controleur: 'Sami' }), 'validation');
  await rejects(erp.recordControle(admin, { equipementId: eq.id, date: '2025-12-25', resultat: 'conforme', controleur: 'Sami' }), 'validation');
});

test('non-conformité : créée automatiquement depuis un contrôle négatif, observations obligatoires', async () => {
  const { erp, eq, et } = await setup();
  await rejects(erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-10', resultat: 'non_conforme', controleur: 'Sami', observations: '' }), 'validation');
  const r = await erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-10', resultat: 'non_conforme', controleur: 'Sami', observations: 'Manomètre à zéro' });
  assert.equal(r.nonConformite?.statut, 'ouverte');
  const list = await erp.listNonConformites(admin, { etablissementId: et.id });
  assert.equal(list.length, 1);
  assert.equal(list[0].description, 'Manomètre à zéro');
  const reg = await erp.listRegistre(admin, { etablissementId: et.id });
  assert.deepEqual(reg.items.map((e) => e.type).sort(), ['controle', 'non_conformite']);
});

test('plan d’action : la levée exige des actions et qu’elles soient toutes terminées', async () => {
  const { erp, eq } = await setup();
  const { nonConformite: nc } = await erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-10', resultat: 'non_conforme', controleur: 'Sami', observations: 'Fuite' });
  await rejects(erp.lever(admin, nc!.id, {}), 'conflict'); // aucun plan d'action
  const a = await erp.addAction(admin, { nonConformiteId: nc!.id, description: 'Remplacer', responsable: 'Karim', echeance: '2026-12-01' });
  assert.equal((await erp.getNonConformite(admin, nc!.id)).nonConformite.statut, 'en_cours');
  await rejects(erp.lever(admin, nc!.id, {}), 'conflict'); // action non terminée
  await erp.updateAction(admin, a.id, { statut: 'terminee' });
  const done = await erp.lever(admin, nc!.id, { note: 'Remplacé et vérifié' });
  assert.equal(done.statut, 'levee');
  await rejects(erp.addAction(admin, { nonConformiteId: nc!.id, description: 'x', responsable: 'y', echeance: '2026-12-02' }), 'conflict');
});

test('registre : entrées chaînées par hash, toute falsification ou suppression est détectée', async () => {
  const { erp, eq, et } = await setup();
  for (const d of ['2026-10-01', '2026-10-15', '2026-11-01']) await erp.recordControle(admin, { equipementId: eq.id, date: d, resultat: 'conforme', controleur: 'Sami' });
  const first = await erp.listRegistre(admin, { etablissementId: et.id });
  assert.equal(first.total, 3);
  assert.deepEqual(first.integrity, { ok: true, checked: 3 });
  // Simulation d'une attaque directement en base : on reconstruit la liste telle qu'un attaquant la laisserait.
  const rows = [...first.items].reverse().map((e) => JSON.parse(JSON.stringify(e)));
  const edited = JSON.parse(JSON.stringify(rows)); edited[1].payload.resultat = 'non_conforme';
  assert.match(verifyChain(edited).reason!, /hash invalide/);
  const removed = rows.filter((_, i) => i !== 1);
  assert.equal(verifyChain(removed).ok, false);
  const retimed = JSON.parse(JSON.stringify(rows)); retimed[0].occurredAt = '2020-01-01T00:00:00.000Z';
  assert.equal(verifyChain(retimed).ok, false);
});

test('registre : aucune méthode de modification ni de suppression ; une correction est une nouvelle entrée liée', async () => {
  const { erp, eq, et } = await setup();
  await erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-01', resultat: 'conforme', controleur: 'Sami' });
  const repoJournal = (erp as any).repo.journal;
  assert.deepEqual(Object.keys(repoJournal).sort(), ['append', 'get', 'list']);
  const [orig] = (await erp.listRegistre(admin, { etablissementId: et.id })).items;
  const corr = await erp.corriger(admin, { entryId: orig.id, motif: 'Erreur de saisie du contrôleur', correction: 'Le contrôleur était Amel Gharbi' });
  assert.equal(corr.type, 'correction');
  assert.equal(corr.corrigeId, orig.id);
  const after = await erp.listRegistre(admin, { etablissementId: et.id });
  assert.equal(after.total, 2);
  assert.equal(after.items.find((e) => e.id === orig.id)!.hash, orig.hash, 'l’original est intact');
  assert.equal(after.items.find((e) => e.id === orig.id)!.corrigee, true);
  assert.equal(after.integrity.ok, true);
});

test('droits d’accès : rôles et périmètre par établissement', async () => {
  const { erp, et, eq } = await setup();
  const autre = await erp.createEtablissement(admin, { nom: 'Autre', typeActivite: 'Commerce', categorie: '5', effectifMax: 20, adresse: '' });
  const exploitant = actor('exploitant', [et.id]);
  const auditeur = actor('auditeur', [et.id, autre.id]);
  const technicien = actor('technicien', [et.id]);
  assert.deepEqual((await erp.listEtablissements(exploitant)).map((e) => e.id), [et.id], 'liste filtrée par périmètre');
  await rejects(erp.getEtablissement(exploitant, autre.id), 'forbidden');
  await rejects(erp.listEquipements(exploitant, { etablissementId: autre.id }), 'forbidden');
  await rejects(erp.listRegistre(exploitant, { etablissementId: autre.id }), 'forbidden');
  await rejects(erp.recordControle(auditeur, { equipementId: eq.id, date: '2026-11-01', resultat: 'conforme', controleur: 'X Y' }), 'forbidden'); // lecture seule
  await rejects(erp.createEtablissement(exploitant, { nom: 'Z', typeActivite: 'a', categorie: '5', effectifMax: 1 }), 'forbidden');
  await rejects(erp.setRule(exploitant, { typeEquipementId: eq.typeId, categorie: null, periodiciteMois: 6 }), 'forbidden');
  const r = await erp.recordControle(technicien, { equipementId: eq.id, date: '2026-11-01', resultat: 'non_conforme', controleur: 'Tech Ext', observations: 'Rouille' });
  await rejects(erp.addAction(technicien, { nonConformiteId: r.nonConformite!.id, description: 'a', responsable: 'b', echeance: '2026-12-01' }), 'forbidden'); // le technicien ne pilote pas le plan d'action
  const eqAutre = await erp.createEquipement(admin, { etablissementId: autre.id, typeId: eq.typeId, libelle: 'X', dateMiseEnService: '2026-01-01' });
  await rejects(erp.recordControle(technicien, { equipementId: eqAutre.id, date: '2026-11-01', resultat: 'conforme', controleur: 'Tech Ext' }), 'forbidden');
  assert.equal((await erp.listEquipements(auditeur)).total, 2);
});

test('alertes : avant échéance et en retard, sans doublon, avec reprise après une panne d’envoi', async () => {
  const sent: string[] = [];
  let down = false;
  const mailer: Mailer = { async send(to, subject, text) { if (down) throw new Error('SMTP indisponible'); sent.push(`${to}|${subject}|${text}`); } };
  const { erp, c, eq } = await setup({ mailer });
  assert.equal((await erp.runAlerts()).mails, 0, 'échéance lointaine : rien');
  c.set('2026-12-20'); // échéance 2027-01-15 dans 26 jours
  down = true;
  const fail = await erp.runAlerts();
  assert.equal(fail.echecs.length, 1); assert.equal(sent.length, 0);
  down = false;
  assert.equal((await erp.runAlerts()).mails, 1, 'réessai réussi au passage suivant');
  assert.match(sent[0], /À VENIR/);
  assert.equal((await erp.runAlerts()).mails, 0, 'idempotent : pas de doublon');
  c.set('2027-01-20'); // en retard
  assert.equal((await erp.runAlerts()).mails, 1); assert.match(sent[1], /EN RETARD/);
  assert.equal((await erp.runAlerts()).mails, 0);
  c.set('2027-01-27'); // semaine suivante : rappel hebdomadaire
  assert.equal((await erp.runAlerts()).mails, 1);
  await erp.recordControle(admin, { equipementId: eq.id, date: '2027-01-27', resultat: 'conforme', controleur: 'Sami' });
  c.set('2027-02-05');
  assert.equal((await erp.runAlerts()).mails, 0, 'contrôle effectué : plus d’alerte');
});

test('validation : XSS neutralisé, photo falsifiée refusée, QR code unique et retrouvable', async () => {
  const { erp, ext, et, eq } = await setup();
  const e2 = await erp.createEquipement(admin, { etablissementId: et.id, typeId: ext.id, libelle: '<script>alert(1)</script>Extincteur <b>2</b>', dateMiseEnService: '2026-02-01' });
  assert.equal(e2.libelle, 'alert(1)Extincteur 2');
  assert.notEqual(e2.qrCode, eq.qrCode);
  assert.match(eq.qrCode, /^EQ-[0-9A-F]{12}$/);
  assert.equal((await erp.findByQr(admin, eq.qrCode.toLowerCase())).equipement.id, eq.id);
  await rejects(erp.findByQr(admin, 'EQ-INEXISTANT'), 'not_found');
  const fake = Buffer.from('ceci n’est pas une image').toString('base64');
  await rejects(erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-01', resultat: 'conforme', controleur: 'Sami', photo: { nom: 'x.jpg', mime: 'image/jpeg', base64: fake } }), 'validation');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]).toString('base64');
  const ok = await erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-01', resultat: 'conforme', controleur: 'Sami', photo: { nom: 'x.jpg', mime: 'image/jpeg', base64: jpeg } });
  assert.ok(ok.controle.documentId);
  await rejects(erp.addBatiment(admin, { etablissementId: "x' OR '1'='1", nom: 'B' }), 'validation');
  await rejects(erp.getEquipement(admin, 'nope'), 'not_found');
});

test('export PDF du registre : PDF valide, en-tête d’intégrité, contenu des entrées', async () => {
  const { erp, eq, et } = await setup();
  await erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-01', resultat: 'non_conforme', controleur: 'Sami Trabelsi', observations: 'Goupille manquante (é à ç)' });
  const pdf = await erp.exportRegistrePdf(admin, { etablissementId: et.id });
  const buf = Buffer.from(pdf.base64, 'base64');
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buf.toString('latin1').includes('%%EOF'));
  assert.ok(buf.toString('latin1').includes('REGISTRE DE SECURITE'));
  assert.ok(buf.toString('latin1').includes('Goupille manquante'));
  assert.equal(pdf.integrity.ok, true);
  assert.match(pdf.filename, /^registre-hotel-test-2026-11-19\.pdf$/);
});

test('tableau de bord : taux de conformité, retards et non-conformités ouvertes', async () => {
  const { erp, c, ext, et, eq } = await setup();
  await erp.createEquipement(admin, { etablissementId: et.id, typeId: ext.id, libelle: 'Ext. 2', dateMiseEnService: '2025-01-01' }); // en retard
  let d = await erp.dashboard(admin);
  assert.equal(d.global.equipements, 2); assert.equal(d.global.enRetard, 1); assert.equal(d.global.tauxConformite, 50);
  await erp.recordControle(admin, { equipementId: eq.id, date: '2026-11-01', resultat: 'non_conforme', controleur: 'Sami', observations: 'Défaut' });
  d = await erp.dashboard(admin, et.id);
  assert.equal(d.global.ncOuvertes, 1); assert.equal(d.global.tauxConformite, 0);
  assert.equal(d.equipementsEnRetard.length, 1);
  c.set('2026-11-19');
});

test('authentification : mot de passe haché, jeton signé et expirant, message d’erreur identique', async () => {
  const { erp, et } = await setup();
  await erp.createUser(admin, { email: 'Chef@Test.tn', nom: 'Chef', role: 'exploitant', password: 'MotDePasse123', etablissementIds: [et.id] });
  await rejects(erp.createUser(admin, { email: 'chef@test.tn', nom: 'X', role: 'admin', password: 'MotDePasse123' }), 'conflict');
  await rejects(erp.createUser(actor('exploitant', [et.id]), { email: 'z@test.tn', nom: 'Z', role: 'admin', password: 'MotDePasse123' }), 'forbidden');
  const stored = (await (erp as any).repo.users.find())[0].passwordHash as string;
  assert.ok(stored.startsWith('scrypt$') && !stored.includes('MotDePasse'));
  const { token, actor: a } = await erp.login('chef@test.tn', 'MotDePasse123');
  assert.deepEqual(a.etablissementIds, [et.id]);
  const back: Actor = verifyToken(token, 'test-secret');
  assert.equal(back.role, 'exploitant');
  assert.throws(() => verifyToken(token + 'x', 'test-secret'), ErpError);
  assert.throws(() => verifyToken(token, 'autre-secret'), ErpError);
  assert.throws(() => verifyToken(token, 'test-secret', Date.now() + 9 * 3600 * 1000), ErpError, 'jeton expiré');
  const e1 = await erp.login('chef@test.tn', 'faux').catch((e) => e), e2 = await erp.login('inconnu@test.tn', 'faux').catch((e) => e);
  assert.equal(e1.message, e2.message);
});
