import { LmsError, unauthenticated, forbidden } from '../core/errors';
import { guestId, type LmsService } from '../core/services';
import type { Actor } from '../core/types';

/**
 * Routes PUBLIQUES (site visiteur) : /api/modules/local.lms/public/…
 *
 * Principe de sécurité : un visiteur n'a jamais que le rôle `apprenant` — il passe par les MÊMES méthodes du cœur métier
 * que n'importe quel apprenant (visibilité, contenu réservé aux inscrits, bonnes réponses jamais envoyées, score calculé
 * par le serveur). Aucune route publique ne permet de créer ni de modifier un cours. Les champs acceptés sont recopiés un
 * par un : ce qui n'est pas listé ici est ignoré.
 *
 * Les comptes viennent du module « Espace client » (novalabs.customers) : `deps.identify(cookies)` renvoie le client connecté.
 */
export interface Visitor { id: string; nom: string; email: string }
export interface PublicDeps {
  /** Client connecté d'après les cookies de la requête, ou null. */
  identify(cookies: Record<string, string>): Promise<Visitor | null>;
  settings(): { openEnrollment: boolean; linkByEmail: boolean };
  /** Le module d'authentification (Espace client) est-il actif ? */
  accountsAvailable(): boolean;
}
export interface PublicReq { query: Record<string, string>; body: any; cookies: Record<string, string>; ip: string }
export interface PublicRoute { method: 'GET' | 'POST'; path: string; write?: boolean; run: (req: PublicReq) => Promise<unknown> }

const ANONYME: Actor = { id: 'visiteur-anonyme', nom: 'Visiteur', role: 'apprenant' };
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Limiteur de débit en mémoire (fenêtre glissante) : freine l'essai en série de codes de certificat. */
export function makeLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= max) { hits.set(key, recent); return false; }
    recent.push(t); hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
    return true;
  };
}

export function publicRoutes(lms: LmsService, deps: PublicDeps, now: () => number = Date.now): PublicRoute[] {
  const allowVerify = makeLimiter(20, 60_000, now);
  const actorOf = async (req: PublicReq): Promise<Actor | null> => {
    const v = await deps.identify(req.cookies);
    if (!v) return null;
    const email = v.email.trim().toLowerCase(); // même normalisation que l'inscription par e-mail faite par un formateur
    return { id: v.id, nom: v.nom, email, role: 'apprenant', aliases: deps.settings().linkByEmail && email ? [guestId(email)] : [] };
  };
  const need = async (req: PublicReq) => (await actorOf(req)) ?? (() => { throw unauthenticated('Connectez-vous pour suivre les cours'); })();

  return [
    { method: 'GET', path: '/public/me', run: async (req) => {
      const a = await actorOf(req);
      return { customer: a ? { id: a.id, nom: a.nom, email: a.email } : null, accountsAvailable: deps.accountsAvailable(), openEnrollment: deps.settings().openEnrollment };
    } },
    // Catalogue et plan d'un cours : accessibles sans compte (le contenu des leçons, lui, reste réservé aux inscrits).
    { method: 'GET', path: '/public/cours', run: async (req) => (await lms.listCourses((await actorOf(req)) ?? ANONYME)).map(({ peutGerer: _p, inscrits: _i, ...c }) => c) },
    { method: 'GET', path: '/public/cours/detail', run: async (req) => { const { peutGerer: _p, ...d } = await lms.getCourse((await actorOf(req)) ?? ANONYME, str(req.query.id)); return d; } },
    { method: 'POST', path: '/public/inscription', write: true, run: async (req) => {
      const a = await need(req);
      if (!deps.settings().openEnrollment) throw forbidden('Les inscriptions sont gérées par le formateur de ce cours');
      const e = await lms.enroll(a, { courseId: str(req.body?.courseId) });
      return { id: e.id, courseId: e.courseId };
    } },
    { method: 'POST', path: '/public/lecon/terminer', write: true, run: async (req) => lms.completeLesson(await need(req), { enrollmentId: str(req.body?.enrollmentId), lessonId: str(req.body?.lessonId) }) },
    { method: 'POST', path: '/public/quiz/soumettre', write: true, run: async (req) => lms.submitQuiz(await need(req), { enrollmentId: str(req.body?.enrollmentId), reponses: req.body?.reponses }) },
    { method: 'GET', path: '/public/certificats', run: async (req) => lms.listCertificats(await need(req)) },
    { method: 'GET', path: '/public/certificat/pdf', run: async (req) => lms.certificatPdf(await need(req), str(req.query.id)) },
    { method: 'GET', path: '/public/certificat/verifier', run: async (req) => {
      if (!allowVerify(req.ip)) throw new LmsError('forbidden', 'Trop de vérifications : réessayez dans une minute');
      return lms.verifyCertificat(str(req.query.code));
    } },
  ];
}
