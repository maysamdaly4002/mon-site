import type { ErpService } from '../core/services';
import { addDays, addMonths } from '../core/dates';
import type { Actor, Categorie } from '../core/types';

export const DEMO_PASSWORD = 'Demo1234!';

/**
 * Jeu de démonstration : 2 établissements, 34 équipements, contrôles variés (à jour, à venir, en retard), 2 non-conformités.
 * ⚠ Les périodicités ci-dessous sont des valeurs de DÉMONSTRATION, à valider avec la réglementation applicable.
 */
export async function seedDemo(erp: ErpService, admin: Actor, today: string) {
  const types: Record<string, string> = {};
  for (const [code, libelle, mois] of [['extincteur', 'Extincteur', 12], ['alarme', 'Alarme incendie', 12], ['eclairage_securite', 'Éclairage de sécurité (BAES)', 12], ['desenfumage', 'Désenfumage', 12], ['ria', 'Robinet d’incendie armé (RIA)', 12], ['issue_secours', 'Issue de secours', 3]] as const) {
    types[code] = (await erp.createType(admin, { code, libelle, periodiciteDefautMois: mois })).id;
  }
  // Règles par catégorie (exemples) : 1re/2e catégorie → désenfumage et alarme contrôlés plus souvent.
  for (const categorie of ['1', '2'] as Categorie[]) {
    await erp.setRule(admin, { typeEquipementId: types.desenfumage, categorie, periodiciteMois: 6 });
    await erp.setRule(admin, { typeEquipementId: types.alarme, categorie, periodiciteMois: 6 });
  }

  const hotel = await erp.createEtablissement(admin, { nom: 'Hôtel Carthage Palace', adresse: 'Avenue Habib Bourguiba, La Marsa', typeActivite: 'Hôtel (type O)', categorie: '3', effectifMax: 420, emailAlertes: 'securite@carthage-palace.example.tn' });
  const ecole = await erp.createEtablissement(admin, { nom: 'École Les Oliviers', adresse: 'Rue des Oliviers, Sousse', typeActivite: 'École (type R)', categorie: '4', effectifMax: 180, emailAlertes: 'direction@oliviers.example.tn' });

  const levels: Record<string, Record<string, string>> = {};
  for (const [et, nom, niveaux] of [[hotel, 'Bâtiment principal', ['Sous-sol', 'RDC', 'Étage 1', 'Étage 2']], [ecole, 'Bloc classes', ['RDC', 'Étage 1']]] as const) {
    const b = await erp.addBatiment(admin, { etablissementId: et.id, nom });
    levels[et.id] = {};
    let ordre = 0;
    for (const n of niveaux) levels[et.id][n] = (await erp.addNiveau(admin, { batimentId: b.id, nom: n, ordre: ordre++ })).id;
  }

  const specs: [string, string, string, string, string][] = []; // [établissementId, type, libellé, niveau, emplacement]
  for (const n of ['Sous-sol', 'RDC', 'Étage 1', 'Étage 2']) {
    specs.push([hotel.id, 'extincteur', `Extincteur eau pulvérisée ${n}`, n, 'Couloir, près de l’escalier'], [hotel.id, 'extincteur', `Extincteur CO2 ${n}`, n, 'Local technique'], [hotel.id, 'eclairage_securite', `BAES ${n}`, n, 'Sortie de l’escalier']);
  }
  specs.push([hotel.id, 'alarme', 'Centrale d’alarme incendie', 'RDC', 'Poste de sécurité'], [hotel.id, 'desenfumage', 'Désenfumage escalier principal', 'RDC', 'Cage d’escalier'],
    [hotel.id, 'ria', 'RIA cuisine', 'RDC', 'Cuisine'], [hotel.id, 'ria', 'RIA sous-sol', 'Sous-sol', 'Parking'],
    [hotel.id, 'issue_secours', 'Issue de secours hall', 'RDC', 'Hall d’accueil'], [hotel.id, 'issue_secours', 'Issue de secours restaurant', 'RDC', 'Restaurant'], [hotel.id, 'issue_secours', 'Issue de secours étage 2', 'Étage 2', 'Fond du couloir']);
  for (const n of ['RDC', 'Étage 1']) {
    specs.push([ecole.id, 'extincteur', `Extincteur classe A ${n}`, n, 'Couloir'], [ecole.id, 'extincteur', `Extincteur classe B ${n}`, n, 'Laboratoire'], [ecole.id, 'extincteur', `Extincteur CO2 ${n}`, n, 'Salle informatique'], [ecole.id, 'eclairage_securite', `BAES couloir ${n}`, n, 'Couloir'], [ecole.id, 'eclairage_securite', `BAES escalier ${n}`, n, 'Escalier']);
  }
  specs.push([ecole.id, 'alarme', 'Alarme incendie (type 4)', 'RDC', 'Bureau de la direction'], [ecole.id, 'desenfumage', 'Désenfumage escalier', 'Étage 1', 'Escalier'],
    [ecole.id, 'issue_secours', 'Issue de secours cour', 'RDC', 'Cour'], [ecole.id, 'issue_secours', 'Issue de secours étage', 'Étage 1', 'Escalier extérieur'], [ecole.id, 'issue_secours', 'Issue de secours réfectoire', 'RDC', 'Réfectoire']);

  const created = [];
  for (const [i, [etId, type, libelle, niveau, emplacement]] of specs.entries()) {
    const controlled = i % 3 === 0;
    const age = controlled ? 14 + (i % 10) : [3, 8, 11, 13][i % 4];
    created.push(await erp.createEquipement(admin, { etablissementId: etId, niveauId: levels[etId][niveau], typeId: types[type], libelle, emplacement, dateMiseEnService: addMonths(today, -age) }));
  }
  const operator = { ...admin, nom: 'Administrateur démo' };
  const ncs = [];
  for (const [i, e] of created.entries()) {
    if (i % 3 !== 0) continue;
    const bad = i === 3 || i === 24;
    const r = await erp.recordControle(operator, {
      equipementId: e.id, date: addDays(today, -((i * 9) % 200) - 1), resultat: bad ? 'non_conforme' : 'conforme', controleur: i % 2 ? 'Sami Trabelsi' : 'Amel Gharbi',
      observations: bad ? 'Pression insuffisante, scellé manquant.' : i % 6 === 0 ? 'RAS.' : '',
    });
    if (r.nonConformite) ncs.push(r.nonConformite);
  }
  if (ncs[0]) {
    const act = await erp.addAction(operator, { nonConformiteId: ncs[0].id, description: 'Remplacer l’extincteur et reposer le scellé', responsable: 'Karim Jebali', echeance: addDays(today, 10) });
    await erp.updateAction(operator, act.id, { statut: 'en_cours' });
  }
  await erp.addExercice(operator, { etablissementId: hotel.id, type: 'evacuation', date: addDays(today, -120), participants: 64, dureeMin: 12, observations: 'Évacuation en 4 min 30.', recyclageMois: 6 });
  await erp.addExercice(operator, { etablissementId: ecole.id, type: 'formation', date: addDays(today, -400), participants: 9, dureeMin: 180, observations: 'Manipulation des extincteurs.', recyclageMois: 12 });
  await erp.addIntervention(operator, { etablissementId: hotel.id, date: addDays(today, -30), intervenant: 'Sécurité Plus SARL', description: 'Maintenance annuelle de la centrale d’alarme.' });

  const visite = await erp.addVisite(operator, {
    etablissementId: hotel.id, date: addDays(today, -60), avis: 'favorable', president: 'Commission régionale de sécurité', observations: 'Avis favorable sous réserve des prescriptions ci-dessous.',
    prochaineVisite: addDays(today, 20),
    prescriptions: [{ description: 'Remplacer le bloc autonome d’éclairage de sécurité du couloir étage 2', responsable: 'Karim Jebali', echeance: addDays(today, 15) }, { description: 'Mettre à jour le plan d’évacuation affiché au RDC', responsable: 'Karim Jebali', echeance: addDays(today, -5) }],
  });
  await erp.updatePrescription(operator, visite.prescriptions[1].id, { statut: 'en_cours' });
  for (const [email, nom, role, etabs] of [['admin@demo.tn', 'Administrateur', 'admin', []], ['exploitant@demo.tn', 'Directeur Hôtel', 'exploitant', [hotel.id]], ['technicien@demo.tn', 'Technicien externe', 'technicien', [hotel.id, ecole.id]], ['auditeur@demo.tn', 'Auditeur', 'auditeur', [hotel.id, ecole.id]]] as const) {
    await erp.createUser(admin, { email, nom, role, password: DEMO_PASSWORD, etablissementIds: [...etabs] });
  }
  return { hotel, ecole, equipements: created.length, types };
}
