import type { LmsService } from '../core/services';
import type { Actor } from '../core/types';

/**
 * Table de routes UNIQUE, partagée par les deux façons d'exposer le module :
 *  - src/server.ts     → routes d'administration Snapify (session du CMS) ;
 *  - src/standalone.ts → API HTTP autonome (jeton JWT, vrais codes HTTP).
 * Aucune logique métier ici : chaque route appelle une méthode de LmsService, qui contrôle les droits.
 */
export type Input = Record<string, any>;
export interface Route { method: 'GET' | 'POST'; path: string; write?: boolean; pdf?: boolean; public?: boolean; run: (lms: LmsService, a: Actor, i: Input) => Promise<unknown> }
const rest = ({ id: _id, ...r }: Input) => r;

export const routes: Route[] = [
  { method: 'GET', path: '/dashboard', run: (s, a) => s.dashboard(a) },

  { method: 'GET', path: '/cours', run: (s, a) => s.listCourses(a) },
  { method: 'GET', path: '/cours/detail', run: (s, a, i) => s.getCourse(a, String(i.id)) },
  { method: 'POST', path: '/cours/save', write: true, run: (s, a, i) => (i.id ? s.updateCourse(a, String(i.id), rest(i)) : s.createCourse(a, i)) },
  { method: 'POST', path: '/cours/statut', write: true, run: (s, a, i) => s.setCourseStatut(a, String(i.id), rest(i)) },

  { method: 'POST', path: '/chapitre/save', write: true, run: (s, a, i) => (i.id ? s.updateChapter(a, String(i.id), rest(i)) : s.addChapter(a, i)) },
  { method: 'POST', path: '/chapitre/archive', write: true, run: (s, a, i) => s.archiveChapter(a, String(i.id)) },
  { method: 'POST', path: '/lecon/save', write: true, run: (s, a, i) => (i.id ? s.updateLesson(a, String(i.id), rest(i)) : s.addLesson(a, i)) },
  { method: 'POST', path: '/lecon/archive', write: true, run: (s, a, i) => s.archiveLesson(a, String(i.id)) },

  { method: 'POST', path: '/quiz/save', write: true, run: (s, a, i) => s.saveQuiz(a, i) },
  { method: 'POST', path: '/question/save', write: true, run: (s, a, i) => (i.id ? s.updateQuestion(a, String(i.id), rest(i)) : s.addQuestion(a, i)) },
  { method: 'POST', path: '/question/archive', write: true, run: (s, a, i) => s.archiveQuestion(a, String(i.id)) },

  { method: 'POST', path: '/inscription/add', write: true, run: (s, a, i) => s.enroll(a, i) },
  { method: 'GET', path: '/inscriptions', run: (s, a, i) => s.listEnrollments(a, i.courseId ? String(i.courseId) : undefined) },
  { method: 'GET', path: '/inscription', run: (s, a, i) => s.getEnrollment(a, String(i.id)) },
  { method: 'GET', path: '/inscriptions/export', run: async (s, a, i) => ({ csv: await s.exportInscriptionsCsv(a, i.courseId ? String(i.courseId) : undefined) }) },
  { method: 'POST', path: '/inscriptions/import', write: true, run: (s, a, i) => s.importInscriptions(a, i) },
  { method: 'POST', path: '/lecon/terminer', write: true, run: (s, a, i) => s.completeLesson(a, i) },
  { method: 'POST', path: '/quiz/soumettre', write: true, run: (s, a, i) => s.submitQuiz(a, i) },

  { method: 'GET', path: '/certificats', run: (s, a) => s.listCertificats(a) },
  { method: 'GET', path: '/certificats/export', run: async (s, a) => ({ csv: await s.exportCertificatsCsv(a) }) },
  { method: 'GET', path: '/certificat/pdf', pdf: true, run: (s, a, i) => s.certificatPdf(a, String(i.id)) },
  /** Publique en API autonome (vérification par un tiers) ; dans Snapify, comme toute route d'administration, elle exige la session du CMS. */
  { method: 'GET', path: '/certificat/verifier', public: true, run: (s, _a, i) => s.verifyCertificat(i.code) },

  { method: 'POST', path: '/users/add', write: true, run: (s, a, i) => s.createUser(a, i) },
];
