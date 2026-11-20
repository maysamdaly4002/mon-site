import { z } from 'zod';
import { COURSE_STATUTS, LESSON_TYPES, MEDIA_MAX, MEDIA_TYPES, NIVEAUX, ROLES } from './types';

/** Supprime balises HTML et caractères de contrôle : défense en profondeur contre le XSS stocké
 *  (React échappe déjà à l'affichage ; les sauts de ligne sont conservés pour le texte des leçons). */
export const stripHtml = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

const text = (max: number) => z.string().transform(stripHtml).pipe(z.string().trim().max(max));
const req = (max: number, label: string) => text(max).pipe(z.string().min(1, `${label} obligatoire`));
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Identifiant invalide');
const email = z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.string().email('E-mail invalide').max(254));
const int = (min: number, max: number, label: string) => z.coerce.number({ invalid_type_error: `${label} : nombre requis` }).int(`${label} : entier requis`).min(min, `${label} : minimum ${min}`).max(max, `${label} : maximum ${max}`);

// ───────── Cours, chapitres, leçons ─────────
export const courseInput = z.object({ titre: req(120, 'Titre'), description: text(2000).default(''), niveau: z.enum(NIVEAUX).default('debutant') });
export const coursePatch = courseInput.partial();
export const statutInput = z.object({ statut: z.enum(COURSE_STATUTS) });
export const chapterInput = z.object({ courseId: id, titre: req(120, 'Titre') });
export const chapterPatch = z.object({ titre: req(120, 'Titre').optional(), position: int(0, 1000, 'Position').optional() });

/** Contenu d'une leçon : texte (retours à la ligne conservés) ou adresse https:// (vidéo ou ressource externe). Jamais d'autre schéma d'URL. */
export const contenuTexte = z.string().transform(stripHtml).pipe(z.string().trim().min(1, 'Contenu obligatoire').max(20_000, 'Texte trop long (20 000 caractères max)'));
export const contenuUrl = z.string().trim().regex(/^https:\/\/[^\s<>"'`]{4,480}$/, 'Adresse https:// valide requise');
export const contenuFor = (type: (typeof LESSON_TYPES)[number]) => (type === 'texte' ? contenuTexte : contenuUrl);
/** Texte d'une leçon qui a des médias : peut rester vide (la leçon est alors composée uniquement de médias). */
const contenuTexteFacultatif = z.string().transform(stripHtml).pipe(z.string().trim().max(20_000, 'Texte trop long (20 000 caractères max)'));
/** Valide le contenu principal d'une leçon. Un texte ne peut être vide que si la leçon porte au moins un média. */
export function parseContenu(type: (typeof LESSON_TYPES)[number], contenu: string, hasMedias: boolean): { ok: true; data: string } | { ok: false; message: string } {
  const r = (type === 'texte' && hasMedias ? contenuTexteFacultatif : contenuFor(type)).safeParse(contenu);
  return r.success ? { ok: true, data: r.data } : { ok: false, message: r.error.issues[0].message };
}

/** Média complémentaire : même règle que les liens du contenu principal (https:// uniquement, jamais d'autre schéma). */
export const mediaInput = z.object({ type: z.enum(MEDIA_TYPES), titre: text(120).default(''), url: contenuUrl });
export const mediasInput = z.array(mediaInput).max(MEDIA_MAX, `${MEDIA_MAX} médias maximum par leçon`);

export const lessonInput = z.object({
  courseId: id, chapterId: id, titre: req(120, 'Titre'), type: z.enum(LESSON_TYPES), contenu: z.string(), medias: mediasInput.default([]), dureeMin: int(0, 600, 'Durée').default(0),
}).superRefine((l, ctx) => {
  const r = parseContenu(l.type, l.contenu, l.medias.length > 0);
  if (!r.ok) ctx.addIssue({ code: 'custom', path: ['contenu'], message: r.message });
}).transform((l) => ({ ...l, contenu: (parseContenu(l.type, l.contenu, l.medias.length > 0) as { ok: true; data: string }).data }));
export const lessonPatch = z.object({ titre: req(120, 'Titre').optional(), contenu: z.string().optional(), medias: mediasInput.optional(), dureeMin: int(0, 600, 'Durée').optional(), position: int(0, 1000, 'Position').optional() });

// ───────── Quiz ─────────
export const quizInput = z.object({ courseId: id, titre: req(120, 'Titre').default('Quiz final'), seuil: int(1, 100, 'Seuil').default(70), tentativesMax: int(0, 20, 'Tentatives').default(3) });
const questionBase = z.object({ enonce: req(500, 'Énoncé'), choix: z.array(req(200, 'Choix')).min(2, '2 choix minimum').max(6, '6 choix maximum'), bonnes: z.array(int(0, 5, 'Réponse')).min(1, 'Indiquez au moins une bonne réponse').max(6) });
const checkChoices = (q: { choix: string[]; bonnes: number[] }, ctx: z.RefinementCtx) => {
  if (q.bonnes.some((i) => i >= q.choix.length)) ctx.addIssue({ code: 'custom', path: ['bonnes'], message: 'Une bonne réponse ne correspond à aucun choix' });
  if (new Set(q.bonnes).size !== q.bonnes.length) ctx.addIssue({ code: 'custom', path: ['bonnes'], message: 'Bonnes réponses en double' });
  if (new Set(q.choix.map((c) => c.toLowerCase())).size !== q.choix.length) ctx.addIssue({ code: 'custom', path: ['choix'], message: 'Deux choix identiques' });
  if (q.bonnes.length === q.choix.length) ctx.addIssue({ code: 'custom', path: ['bonnes'], message: 'Tous les choix ne peuvent pas être corrects' });
};
export const questionInput = questionBase.extend({ courseId: id }).superRefine(checkChoices);
export const questionPatch = questionBase.partial();
export const questionComplete = questionBase.superRefine(checkChoices);

// ───────── Inscriptions, progression ─────────
export const enrollInput = z.object({ courseId: id, apprenantNom: text(100).optional(), apprenantEmail: email.optional() })
  .refine((e) => (e.apprenantNom === undefined || e.apprenantNom === '') === (e.apprenantEmail === undefined), { message: 'Nom et e-mail de l’apprenant sont tous deux obligatoires' })
  .refine((e) => e.apprenantEmail === undefined || (e.apprenantNom ?? '').length >= 2, { path: ['apprenantNom'], message: 'Nom de l’apprenant obligatoire' });
export const importInput = z.object({ courseId: id, csv: z.string().min(1, 'Fichier vide').max(1_000_000, 'Fichier trop volumineux (1 Mo maximum)'), dryRun: z.boolean().optional() });
export const completeInput = z.object({ enrollmentId: id, lessonId: id });
export const submitInput = z.object({ enrollmentId: id, reponses: z.array(z.array(int(0, 5, 'Réponse')).max(6)).max(200) });
export const codeInput = z.string().trim().toUpperCase().regex(/^CERT-[A-Z0-9]{10}$/, 'Code de certificat invalide');

export const userInput = z.object({ email, nom: req(100, 'Nom'), role: z.enum(ROLES), password: z.string().min(8, '8 caractères minimum').max(200) });
