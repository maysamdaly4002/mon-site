import type { ErpService } from '../core/services';
import { forbidden } from '../core/errors';
import type { Actor } from '../core/types';

/**
 * Table de routes UNIQUE, partagée par les deux façons d'exposer le module :
 *  - src/server.ts     → routes d'administration Snapify (session du CMS) ;
 *  - src/standalone.ts → API HTTP autonome (jeton JWT, vrais codes HTTP).
 * Aucune logique métier ici : chaque route appelle une méthode d'ErpService, qui contrôle les droits.
 */
export type Input = Record<string, any>;
export interface Route { method: 'GET' | 'POST'; path: string; write?: boolean; pdf?: boolean; run: (erp: ErpService, a: Actor, i: Input) => Promise<unknown> }
const n = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));
const str = (v: unknown) => (v === undefined || v === '' ? undefined : String(v));
const rest = ({ id: _id, ...r }: Input) => r;

export const routes: Route[] = [
  { method: 'GET', path: '/dashboard', run: (s, a, i) => s.dashboard(a, str(i.etablissementId)) },

  { method: 'GET', path: '/etablissements', run: (s, a) => s.listEtablissements(a) },
  { method: 'GET', path: '/etablissement', run: (s, a, i) => s.getEtablissement(a, String(i.id)) },
  { method: 'POST', path: '/etablissement/save', write: true, run: (s, a, i) => (i.id ? s.updateEtablissement(a, String(i.id), rest(i)) : s.createEtablissement(a, i)) },
  { method: 'POST', path: '/batiment/add', write: true, run: (s, a, i) => s.addBatiment(a, i) },
  { method: 'POST', path: '/niveau/add', write: true, run: (s, a, i) => s.addNiveau(a, i) },

  { method: 'GET', path: '/types', run: (s, a) => s.listTypes(a) },
  { method: 'POST', path: '/type/save', write: true, run: (s, a, i) => s.createType(a, i) },
  { method: 'POST', path: '/regle/save', write: true, run: (s, a, i) => s.setRule(a, i) },

  { method: 'GET', path: '/equipements', run: (s, a, i) => s.listEquipements(a, { etablissementId: str(i.etablissementId), typeId: str(i.typeId), statut: str(i.statut), etat: str(i.etat), q: str(i.q), page: n(i.page), size: n(i.size) }) },
  { method: 'GET', path: '/equipement', run: (s, a, i) => s.getEquipement(a, String(i.id)) },
  { method: 'GET', path: '/equipement/qr', run: (s, a, i) => s.findByQr(a, String(i.code ?? '')) },
  { method: 'POST', path: '/equipement/save', write: true, run: (s, a, i) => (i.id ? s.updateEquipement(a, String(i.id), rest(i)) : s.createEquipement(a, i)) },

  { method: 'POST', path: '/controle/add', write: true, run: (s, a, i) => s.recordControle(a, i) },
  { method: 'GET', path: '/controles', run: (s, a, i) => s.listControles(a, { etablissementId: String(i.etablissementId), page: n(i.page), size: n(i.size) }) },
  { method: 'GET', path: '/document', run: (s, a, i) => s.getDocument(a, String(i.id)) },

  { method: 'GET', path: '/non-conformites', run: (s, a, i) => s.listNonConformites(a, { etablissementId: str(i.etablissementId), statut: str(i.statut) }) },
  { method: 'GET', path: '/non-conformite', run: (s, a, i) => s.getNonConformite(a, String(i.id)) },
  { method: 'POST', path: '/action/add', write: true, run: (s, a, i) => s.addAction(a, i) },
  { method: 'POST', path: '/action/update', write: true, run: (s, a, i) => s.updateAction(a, String(i.id), rest(i)) },
  { method: 'POST', path: '/non-conformite/lever', write: true, run: (s, a, i) => s.lever(a, String(i.id), rest(i)) },

  { method: 'GET', path: '/registre', run: (s, a, i) => s.listRegistre(a, { etablissementId: String(i.etablissementId), type: str(i.type), page: n(i.page), size: n(i.size) }) },
  { method: 'GET', path: '/registre/verify', run: (s, a, i) => s.verifyRegistre(a, String(i.etablissementId)) },
  { method: 'GET', path: '/registre/pdf', pdf: true, run: (s, a, i) => s.exportRegistrePdf(a, { etablissementId: String(i.etablissementId), from: str(i.from), to: str(i.to) }) },
  { method: 'POST', path: '/registre/intervention', write: true, run: (s, a, i) => s.addIntervention(a, i) },
  { method: 'POST', path: '/registre/correction', write: true, run: (s, a, i) => s.corriger(a, i) },

  { method: 'GET', path: '/exercices', run: (s, a, i) => s.listExercices(a, String(i.etablissementId)) },
  { method: 'POST', path: '/exercice/add', write: true, run: (s, a, i) => s.addExercice(a, i) },

  { method: 'GET', path: '/visites', run: (s, a, i) => s.listVisites(a, String(i.etablissementId)) },
  { method: 'POST', path: '/visite/add', write: true, run: (s, a, i) => s.addVisite(a, i) },
  { method: 'POST', path: '/prescription/add', write: true, run: (s, a, i) => s.addPrescription(a, i) },
  { method: 'POST', path: '/prescription/update', write: true, run: (s, a, i) => s.updatePrescription(a, String(i.id), rest(i)) },

  { method: 'GET', path: '/plans', run: (s, a, i) => s.listPlans(a, String(i.etablissementId)) },
  { method: 'POST', path: '/plan/save', write: true, run: (s, a, i) => s.savePlan(a, i) },
  { method: 'POST', path: '/plan/position', write: true, run: (s, a, i) => s.placeEquipement(a, i) },

  /** Déclenchée par une tâche planifiée (cron) ; idempotente. Réservée à l'administrateur. */
  { method: 'POST', path: '/alertes/run', write: true, run: async (s, a) => { if (a.role !== 'admin') throw forbidden(); return s.runAlerts(); } },
  { method: 'POST', path: '/users/add', write: true, run: (s, a, i) => s.createUser(a, i) },
];
