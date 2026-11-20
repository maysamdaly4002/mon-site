export const ROLES = ['admin', 'instructeur', 'apprenant', 'auditeur'] as const;
export const NIVEAUX = ['debutant', 'intermediaire', 'avance'] as const;
export const COURSE_STATUTS = ['brouillon', 'publie', 'archive'] as const;
export const LESSON_TYPES = ['texte', 'video', 'lien'] as const;
/** Médias complémentaires d'une leçon : vidéo, image, document (PDF, etc.) ou lien externe. */
export const MEDIA_TYPES = ['video', 'image', 'document', 'lien'] as const;
/** Nombre maximal de médias complémentaires par leçon. */
export const MEDIA_MAX = 20;
export type Role = (typeof ROLES)[number];
export type Niveau = (typeof NIVEAUX)[number];
export type CourseStatut = (typeof COURSE_STATUTS)[number];
export type LessonType = (typeof LESSON_TYPES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
/** Un média = une adresse https:// (jamais de fichier hébergé) ; l'ordre du tableau est l'ordre d'affichage. */
export interface LessonMedia { type: MediaType; titre: string; url: string }

interface Dated { createdAt: string }
/** Acteur authentifié. En API autonome : l'utilisateur du jeton ; dans Snapify : l'administrateur connecté du CMS. */
export interface Actor {
  id: string; nom: string; role: Role;
  /** Adresse e-mail connue (compte client) : copiée sur l'inscription pour que le formateur sache qui est inscrit. */
  email?: string;
  /** Autres identifiants de la même personne (ex. inscription antérieure par e-mail faite par un formateur) : ses données lui restent accessibles. */
  aliases?: string[];
}

export interface User extends Dated { id: string; email: string; nom: string; role: Role; passwordHash: string }
export interface Course extends Dated { id: string; titre: string; description: string; niveau: Niveau; statut: CourseStatut; instructeurId: string; instructeurNom: string }
/** Rien n'est supprimé : retirer un chapitre, une leçon ou une question = `archive: true` (l'historique de progression reste lisible). */
export interface Chapter extends Dated { id: string; courseId: string; titre: string; position: number; archive: boolean }
/** `contenu` = contenu principal (texte, ou adresse de la vidéo / du lien) ; `medias` = médias complémentaires affichés à la suite (absent sur les leçons créées avant cette fonction : lu comme `[]`). */
export interface Lesson extends Dated { id: string; courseId: string; chapterId: string; titre: string; type: LessonType; contenu: string; medias: LessonMedia[]; dureeMin: number; position: number; archive: boolean }
export interface Quiz extends Dated { id: string; courseId: string; titre: string; seuil: number; tentativesMax: number }
export interface Question extends Dated { id: string; quizId: string; courseId: string; enonce: string; choix: string[]; bonnes: number[]; position: number; archive: boolean }
export interface Enrollment extends Dated { id: string; courseId: string; apprenantId: string; apprenantNom: string; apprenantEmail: string; inscritPar: string; inscritAt: string; statut: 'en_cours' | 'termine'; termineAt: string | null }
/** Append-only : une ligne par leçon terminée (jamais modifiée ni supprimée). */
export interface Progression extends Dated { id: string; enrollmentId: string; courseId: string; apprenantId: string; lessonId: string; faitAt: string; saisiPar: string }
/** Append-only : une ligne par tentative de quiz ; le score est calculé par le serveur. */
export interface Tentative extends Dated { id: string; quizId: string; courseId: string; enrollmentId: string; apprenantId: string; numero: number; passeAt: string; score: number; reussi: boolean; reponses: number[][] }
/** Append-only : le hash scelle (code, cours, apprenant, date) ; toute modification en base est détectée à la vérification. */
export interface Certificat extends Dated { id: string; courseId: string; apprenantId: string; apprenantNom: string; coursTitre: string; code: string; delivreAt: string; hash: string }
