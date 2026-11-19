import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actor, admin, clock, makeService } from './helpers';
import { ErpError } from '../core/errors';
import { verifyChain } from '../core/registre';
import type { Mailer } from '../core/services';

const rejects = (p: Promise<unknown>, code: ErpError['code']) => assert.rejects(p, (e: unknown) => e instanceof ErpError && e.code === code);
const TODAY = '2026-11-19';
/** PNG 1×1 valide (signature + IHDR + IDAT + IEND). */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function setup(opts: Parameters<typeof makeService>[0] = {}) {
  const c = clock(TODAY);
  const erp = await makeService({ now: c.now, ...opts });
  const ext = await erp.createType(admin, { code: 'extincteur', libelle: 'Extincteur', periodiciteDefautMois: 12 });
  const et = await erp.createEtablissement(admin, { nom: 'Hôtel Test', adresse: 'Tunis', typeActivite: 'Hôtel', categorie: '3', effectifMax: 200, emailAlertes: 'sec@test.tn' });
  const autre = await erp.createEtablissement(admin, { nom: 'École Test', adresse: 'Sousse', typeActivite: 'École', categorie: '4', effectifMax: 100, emailAlertes: '' });
  const bat = await erp.addBatiment(admin, { etablissementId: et.id, nom: 'Principal' });
  const niv = await erp.addNiveau(admin, { batimentId: bat.id, nom: 'RDC', ordre: 0 });
  const eq = await erp.createEquipement(admin, { etablissementId: et.id, niveauId: niv.id, typeId: ext.id, libelle: 'Extincteur RDC', emplacement: 'Hall', dateMiseEnService: '2026-01-15' });
  const eqAutre = await erp.createEquipement(admin, { etablissementId: autre.id, typeId: ext.id, libelle: 'Extincteur école', dateMiseEnService: '2026-01-15' });
  return { erp, c, et, autre, niv, eq, eqAutre };
}
const visiteDe = (etablissementId: string, extra: Record<string, unknown> = {}) => ({
  etablissementId, date: '2026-11-01', avis: 'favorable', president: 'Commission régionale', observations: 'RAS',
  prochaineVisite: '2027-11-01', prescriptions: [{ description: 'Remplacer le BAES du couloir', responsable: 'Karim', echeance: '2026-12-15' }], ...extra,
});

test('visite : enregistre la visite et ses prescriptions, et les inscrit au registre (chaîne intacte)', async () => {
  const { erp, et } = await setup();
  const r = await erp.addVisite(admin, visiteDe(et.id));
  assert.equal(r.prescriptions.length, 1);
  assert.equal(r.prescriptions[0].statut, 'a_faire');
  const reg = await erp.listRegistre(admin, { etablissementId: et.id, type: 'visite' });
  assert.equal(reg.total, 1);
  assert.deepEqual((reg.items[0].payload as any).prescriptions, ['Remplacer le BAES du couloir']);
  assert.equal(reg.integrity.ok, true);
  const l = await erp.listVisites(admin, et.id);
  assert.equal(l.items[0].ouvertes, 1);
  assert.equal(l.prochaineVisite, '2027-11-01');
  assert.equal(l.prochaineVisiteEnRetard, false);
});

test('prescription : suivi jusqu’à la levée, journalisé ; une prescription levée ne se rouvre pas', async () => {
  const { erp, et } = await setup();
  const { prescriptions } = await erp.addVisite(admin, visiteDe(et.id));
  const p = prescriptions[0];
  assert.equal((await erp.updatePrescription(admin, p.id, { statut: 'en_cours' })).statut, 'en_cours');
  const levee = await erp.updatePrescription(admin, p.id, { statut: 'levee' });
  assert.equal(levee.statut, 'levee');
  assert.ok(levee.leveeAt);
  await rejects(erp.updatePrescription(admin, p.id, { statut: 'a_faire' }), 'conflict');
  const events = (await erp.listRegistre(admin, { etablissementId: et.id, type: 'prescription' })).items.map((e) => (e.payload as any).evenement);
  assert.deepEqual(events.reverse(), ['mise_a_jour', 'levee']);
  assert.equal((await erp.listVisites(admin, et.id)).items[0].ouvertes, 0);
  const extra = await erp.addPrescription(admin, { visiteId: p.visiteId, description: 'Nouvelle demande', responsable: 'Karim', echeance: '2027-01-10' });
  assert.equal(extra.statut, 'a_faire');
});

test('visite : validation (date future, prochaine visite antérieure, HTML retiré)', async () => {
  const { erp, et } = await setup();
  await rejects(erp.addVisite(admin, visiteDe(et.id, { date: '2026-12-01' })), 'validation');
  await rejects(erp.addVisite(admin, visiteDe(et.id, { prochaineVisite: '2026-10-01' })), 'validation');
  await rejects(erp.addVisite(admin, visiteDe(et.id, { avis: 'peut-etre' })), 'validation');
  const ok = await erp.addVisite(admin, visiteDe(et.id, { observations: '<script>alert(1)</script>Avis <b>ok</b>' }));
  assert.equal(ok.visite.observations, 'alert(1)Avis ok');
});

test('droits : auditeur et technicien en lecture seule sur visites et plans ; exploitant limité à son établissement', async () => {
  const { erp, et, autre, niv } = await setup();
  for (const role of ['auditeur', 'technicien'] as const) {
    await rejects(erp.addVisite(actor(role), visiteDe(et.id)), 'forbidden');
    await rejects(erp.savePlan(actor(role), { etablissementId: et.id, niveauId: niv.id, image: { nom: 'p', mime: 'image/png', base64: PNG } }), 'forbidden');
  }
  const exploitant = actor('exploitant', [et.id]);
  assert.ok((await erp.addVisite(exploitant, visiteDe(et.id))).visite.id);
  await rejects(erp.addVisite(exploitant, visiteDe(autre.id)), 'forbidden');
  await rejects(erp.listVisites(exploitant, autre.id), 'forbidden');
  await rejects(erp.listPlans(exploitant, autre.id), 'forbidden');
  assert.deepEqual((await erp.listVisites(actor('auditeur', [et.id]), et.id)).items.length, 1);
});

test('alertes : prescription en retard et visite à venir, une seule fois (idempotent), rappel hebdomadaire du retard', async () => {
  const sent: string[] = [];
  const mailer: Mailer = { async send(_to, _s, text) { sent.push(text); } };
  const { erp, c, et } = await setup({ mailer });
  await erp.addVisite(admin, visiteDe(et.id, { prochaineVisite: '2026-12-10', prescriptions: [{ description: 'Dégager l’issue de secours', responsable: 'Karim', echeance: '2026-11-10' }] }));
  const first = await erp.runAlerts();
  assert.equal(first.mails, 1);
  assert.match(sent[0], /PRESCRIPTION DE LA COMMISSION EN RETARD/);
  assert.match(sent[0], /VISITE DE LA COMMISSION À VENIR/);
  assert.equal((await erp.runAlerts()).mails, 0, 'même jour : pas de doublon');
  c.set('2026-11-27');
  const next = await erp.runAlerts();
  assert.equal(next.mails, 1, 'semaine suivante : rappel du retard');
  assert.match(sent[1], /PRESCRIPTION DE LA COMMISSION EN RETARD/);
  assert.doesNotMatch(sent[1], /À VENIR/);
});

test('tableau de bord : prescriptions ouvertes comptées par établissement', async () => {
  const { erp, et } = await setup();
  await erp.addVisite(admin, visiteDe(et.id));
  const d = await erp.dashboard(admin);
  assert.equal(d.global.prescriptionsOuvertes, 1);
  assert.equal(d.parEtablissement.find((x) => x.id === et.id)?.prescriptionsOuvertes, 1);
});

test('plan d’étage : import par niveau, placement, déplacement et retrait d’un équipement', async () => {
  const { erp, et, niv, eq } = await setup();
  const plan = await erp.savePlan(admin, { etablissementId: et.id, niveauId: niv.id, nom: 'Plan RDC', image: { nom: 'rdc.png', mime: 'image/png', base64: PNG } });
  assert.equal((await erp.getDocument(admin, plan.documentId)).mime, 'image/png');
  await erp.placeEquipement(admin, { planId: plan.id, equipementId: eq.id, x: 25.5, y: 60 });
  assert.deepEqual((await erp.listPlans(admin, et.id))[0].positions, [{ equipementId: eq.id, x: 25.5, y: 60 }]);
  await erp.placeEquipement(admin, { planId: plan.id, equipementId: eq.id, x: 80, y: 10 });
  assert.deepEqual((await erp.listPlans(admin, et.id))[0].positions, [{ equipementId: eq.id, x: 80, y: 10 }], 'déplacé, pas dupliqué');
  await erp.placeEquipement(admin, { planId: plan.id, equipementId: eq.id, x: null, y: null });
  assert.deepEqual((await erp.listPlans(admin, et.id))[0].positions, []);
  const again = await erp.savePlan(admin, { etablissementId: et.id, niveauId: niv.id, image: { nom: 'rdc2.png', mime: 'image/png', base64: PNG } });
  assert.equal(again.id, plan.id, 'un seul plan par niveau (remplacé)');
  assert.notEqual(again.documentId, plan.documentId);
  assert.equal((await erp.listPlans(admin, et.id)).length, 1);
});

test('plan d’étage : refuse faux fichiers, coordonnées hors plan, équipement ou niveau d’un autre établissement', async () => {
  const { erp, et, autre, niv, eq, eqAutre } = await setup();
  await rejects(erp.savePlan(admin, { etablissementId: et.id, niveauId: niv.id, image: { nom: 'x.png', mime: 'image/png', base64: Buffer.from('pas une image').toString('base64') } }), 'validation');
  await rejects(erp.savePlan(admin, { etablissementId: autre.id, niveauId: niv.id, image: { nom: 'x.png', mime: 'image/png', base64: PNG } }), 'validation');
  const plan = await erp.savePlan(admin, { etablissementId: et.id, niveauId: niv.id, image: { nom: 'x.png', mime: 'image/png', base64: PNG } });
  await rejects(erp.placeEquipement(admin, { planId: plan.id, equipementId: eq.id, x: 101, y: 5 }), 'validation');
  await rejects(erp.placeEquipement(admin, { planId: plan.id, equipementId: eq.id, x: 10, y: null }), 'validation');
  await rejects(erp.placeEquipement(admin, { planId: plan.id, equipementId: eqAutre.id, x: 10, y: 10 }), 'validation');
  assert.equal(verifyChain((await erp.listRegistre(admin, { etablissementId: et.id })).items.slice().reverse() as any).ok, true);
});

test('registre PDF : contient visites et prescriptions', async () => {
  const { erp, et } = await setup();
  await erp.addVisite(admin, visiteDe(et.id));
  const pdf = Buffer.from((await erp.exportRegistrePdf(admin, { etablissementId: et.id })).base64, 'base64').toString('latin1');
  assert.match(pdf, /VISITE/);
  assert.match(pdf, /commission/i);
});
