import type { LmsService } from '../core/services';
import type { Actor, LessonMedia } from '../core/types';

export const DEMO_PASSWORD = 'Demo1234!';

/** Jeu de démonstration : 3 cours (2 publiés, 1 brouillon), 5 comptes, inscriptions à divers stades, 1 certificat délivré. */
export async function seedDemo(lms: LmsService, admin: Actor) {
  const mk = async (email: string, nom: string, role: Actor['role']) => lms.actorFor((await lms.createUser(admin, { email, nom, role, password: DEMO_PASSWORD })).id);
  const instr = await mk('instructeur@demo.tn', 'Karim Jebali', 'instructeur');
  const amel = await mk('apprenant@demo.tn', 'Amel Ben Salah', 'apprenant');
  const sami = await mk('sami@demo.tn', 'Sami Trabelsi', 'apprenant');
  await mk('auditeur@demo.tn', 'Nadia Auditrice', 'auditeur');

  async function course(titre: string, description: string, chapitres: { titre: string; lecons: [string, 'texte' | 'video' | 'lien', string, number, LessonMedia[]?][] }[], questions: { enonce: string; choix: string[]; bonnes: number[] }[], publier = true) {
    const c = await lms.createCourse(instr, { titre, description, niveau: 'debutant' });
    for (const ch of chapitres) {
      const chap = await lms.addChapter(instr, { courseId: c.id, titre: ch.titre });
      for (const [t, type, contenu, dureeMin, medias] of ch.lecons) await lms.addLesson(instr, { courseId: c.id, chapterId: chap.id, titre: t, type, contenu, dureeMin, medias: medias ?? [] });
    }
    if (questions.length) {
      await lms.saveQuiz(instr, { courseId: c.id, titre: 'Quiz final', seuil: 70, tentativesMax: 3 });
      for (const q of questions) await lms.addQuestion(instr, { courseId: c.id, ...q });
    }
    if (publier) await lms.setCourseStatut(instr, c.id, { statut: 'publie' });
    return c;
  }

  const incendie = await course('Sécurité incendie : les bases', 'Prévenir, détecter et réagir : les réflexes essentiels pour le personnel d’un établissement recevant du public.', [
    { titre: 'Comprendre le feu', lecons: [['Le triangle du feu', 'texte', 'Un feu a besoin de trois éléments : un combustible, un comburant (l’oxygène) et une énergie d’activation.\nSupprimer l’un des trois éteint le feu.', 8], ['Les classes de feux', 'texte', 'Classe A : solides. Classe B : liquides. Classe C : gaz. Classe D : métaux. Classe F : huiles de cuisson.', 10]] },
    { titre: 'Agir', lecons: [['Utiliser un extincteur', 'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 12, [
      { type: 'image', titre: 'Schéma : la méthode PASS', url: 'https://placehold.co/800x450/png?text=P.A.S.S' },
      { type: 'video', titre: 'Démonstration complémentaire', url: 'https://vimeo.com/76979871' },
      { type: 'document', titre: 'Fiche mémo à imprimer (PDF)', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    ]], ['Évacuer en sécurité', 'texte', 'Alerter, fermer les portes sans les verrouiller, suivre les issues de secours, rejoindre le point de rassemblement.', 10], ['Ressources officielles', 'lien', 'https://www.protectioncivile.tn/', 5]] },
  ], [
    { enonce: 'Quels sont les trois éléments du triangle du feu ?', choix: ['Combustible, comburant, énergie', 'Eau, air, terre', 'Fumée, flamme, chaleur'], bonnes: [0] },
    { enonce: 'Quels types de feux concernent la classe B ?', choix: ['Liquides', 'Solides', 'Gaz', 'Métaux'], bonnes: [0] },
    { enonce: 'Que faut-il faire en cas d’évacuation ? (plusieurs réponses)', choix: ['Fermer les portes sans les verrouiller', 'Prendre l’ascenseur', 'Rejoindre le point de rassemblement'], bonnes: [0, 2] },
    { enonce: 'On peut utiliser de l’eau sur un feu d’huile de friture.', choix: ['Vrai', 'Faux'], bonnes: [1] },
  ]);
  const sst = await course('Premiers secours (SST)', 'Les gestes qui sauvent : protéger, alerter, secourir.', [
    { titre: 'Les gestes essentiels', lecons: [['Protéger et alerter', 'texte', 'Sécuriser la zone, puis appeler les secours (190 en Tunisie) en donnant l’adresse précise et l’état de la victime.', 6], ['Position latérale de sécurité', 'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 8], ['Massage cardiaque', 'texte', 'Compressions thoraciques au centre de la poitrine, 100 à 120 par minute, bras tendus.', 10]] },
  ], [
    { enonce: 'Quel est le numéro des secours médicaux d’urgence (SAMU) en Tunisie ?', choix: ['190', '198', '197'], bonnes: [0] },
    { enonce: 'Rythme des compressions thoraciques ?', choix: ['60 par minute', '100 à 120 par minute', '200 par minute'], bonnes: [1] },
    { enonce: 'La première action est de protéger la zone.', choix: ['Vrai', 'Faux'], bonnes: [0] },
  ]);
  await course('Excel avancé (en préparation)', 'Tableaux croisés dynamiques et formules.', [{ titre: 'Introduction', lecons: [['Bienvenue', 'texte', 'Contenu à venir.', 3]] }], [], false);

  // Sami a tout terminé (certificat) ; Amel est à mi-parcours ; une invitée suit le cours en présentiel.
  const finish = async (who: Actor, courseId: string, answers: number[][]) => {
    const e = await lms.enroll(who, { courseId });
    const detail = await lms.getCourse(who, courseId);
    for (const l of detail.chapters.flatMap((c) => c.lessons)) await lms.completeLesson(who, { enrollmentId: e.id, lessonId: l.id });
    return { e, result: await lms.submitQuiz(who, { enrollmentId: e.id, reponses: answers }) };
  };
  await finish(sami, incendie.id, [[0], [0], [0, 2], [1]]);
  const e = await lms.enroll(amel, { courseId: incendie.id });
  const first = (await lms.getCourse(amel, incendie.id)).chapters[0].lessons;
  for (const l of first) await lms.completeLesson(amel, { enrollmentId: e.id, lessonId: l.id });
  await lms.enroll(amel, { courseId: sst.id });
  await lms.enroll(instr, { courseId: sst.id, apprenantNom: 'Hatem Mansour', apprenantEmail: 'hatem@exemple.tn' });
  return { incendie, sst, instr, amel, sami };
}
