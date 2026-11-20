import crypto from 'node:crypto';
import type { z } from 'zod';
import type { LmsRepository } from './repository';
import * as S from './schemas';
import { addDays, isoDay } from './dates';
import { conflict, forbidden, invalid, LmsError, notFound } from './errors';
import { authorize, authorizeCourse, can, canManageCourse, seesAll } from './permissions';
import { certificatePdf } from './pdf';
import { parseCsv, toCsv } from './csv';
import { hashPassword, signToken, verifyPassword } from './auth';
import type { Actor, Certificat, Chapter, Course, CourseStatut, Enrollment, Lesson, Question, Quiz } from './types';

/** Habillage du certificat PDF (lu à chaque génération : les réglages du CMS peuvent changer sans redémarrage). */
export interface CertificateBranding { organisation?: string; signataire?: string; /** Adresse de la page de vérification, ex. https://site.tn/formation/verifier/ — le code est ajouté en paramètre. */ verifyBase?: string }
export interface ServiceOptions { now?: () => Date; jwtSecret?: string; inactiveDays?: number; branding?: () => CertificateBranding }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 signes, sans 0/O/1/I : 256 % 32 = 0 → tirage sans biais
const newCode = () => `CERT-${[...crypto.randomBytes(10)].map((b) => ALPHABET[b % 32]).join('')}`;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const certHash = (c: Pick<Certificat, 'code' | 'courseId' | 'apprenantId' | 'apprenantNom' | 'coursTitre' | 'delivreAt'>) =>
  sha(JSON.stringify([c.code, c.courseId, c.apprenantId, c.apprenantNom, c.coursTitre, c.delivreAt]));
export const guestId = (email: string) => `inv_${sha(email).slice(0, 16)}`;
const byPos = <T extends { position: number; createdAt: string }>(a: T, b: T) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);

export interface ImportReport {
  total: number; created: number;
  duplicates: { line: number; email: string; reason: 'dans_le_fichier' | 'deja_inscrit' }[];
  errors: { line: number; message: string }[];
}
/** En-têtes acceptés pour l'import des apprenants (casse et accents indifférents sur les variantes courantes). */
const IMPORT_HEADERS: Record<string, 'nom' | 'prenom' | 'email'> = {
  nom: 'nom', 'nom complet': 'nom', name: 'nom', lastname: 'nom', last_name: 'nom',
  prenom: 'prenom', 'prénom': 'prenom', firstname: 'prenom', first_name: 'prenom',
  email: 'email', 'e-mail': 'email', mail: 'email', courriel: 'email',
};
const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export interface Resume {
  enrollmentId: string; courseId: string; faites: number; total: number; pourcent: number; leconsFaites: string[];
  quiz: { requis: boolean; reussi: boolean; tentatives: number; meilleurScore: number | null; restantes: number | null; seuil: number | null };
  termine: boolean; termineAt: string | null; certificatId: string | null; certificatCode: string | null;
}

export class LmsService {
  private now: () => Date;
  private inactiveDays: number;
  constructor(private repo: LmsRepository, private opts: ServiceOptions = {}) {
    this.now = opts.now ?? (() => new Date());
    this.inactiveDays = opts.inactiveDays ?? 14;
  }
  private today() { return isoDay(this.now()); }
  private parse<Z extends z.ZodTypeAny>(schema: Z, data: unknown): z.output<Z> {
    const r = schema.safeParse(data ?? {});
    if (!r.success) throw invalid(r.error.issues[0]?.message ?? 'Données invalides', r.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })));
    return r.data;
  }
  /** Identifiants sous lesquels l'acteur apparaît comme apprenant (le sien + ses alias). */
  private ids = (a: Actor) => [a.id, ...(a.aliases ?? [])];
  private owns = (a: Actor, apprenantId: string) => this.ids(a).includes(apprenantId);
  private async mine(a: Actor, courseId?: string): Promise<Enrollment[]> {
    const out: Enrollment[] = [];
    for (const id of this.ids(a)) out.push(...(await this.repo.enrollments.find(courseId ? { courseId, apprenantId: id } : { apprenantId: id })));
    return out;
  }
  private async course(id: string): Promise<Course> { return (await this.repo.courses.get(id)) ?? (() => { throw notFound('Cours'); })(); }
  private async enrollment(id: string): Promise<Enrollment> { return (await this.repo.enrollments.get(id)) ?? (() => { throw notFound('Inscription'); })(); }

  // ───────── Visibilité ─────────
  /** Un brouillon n'existe pas pour ceux qui n'ont aucun droit dessus (« introuvable », pas « interdit »). */
  private async visible(a: Actor, c: Course): Promise<boolean> {
    if (seesAll(a) || canManageCourse(a, c) || c.statut === 'publie') return true;
    return c.statut === 'archive' && (await this.mine(a, c.id)).length > 0;
  }
  private async assertVisible(a: Actor, c: Course) { if (!(await this.visible(a, c))) throw notFound('Cours'); }

  // ───────── Contenu : structure ─────────
  private async chapters(courseId: string): Promise<Chapter[]> { return (await this.repo.chapters.find({ courseId })).filter((c) => !c.archive).sort(byPos); }
  /** Leçons « vivantes » : non archivées, dans un chapitre non archivé. */
  private async lessons(courseId: string): Promise<Lesson[]> {
    const ch = new Set((await this.chapters(courseId)).map((c) => c.id));
    return (await this.repo.lessons.find({ courseId })).filter((l) => !l.archive && ch.has(l.chapterId)).sort(byPos);
  }
  private async activeQuestions(quiz: Quiz): Promise<Question[]> { return (await this.repo.questions.find({ quizId: quiz.id })).filter((q) => !q.archive).sort(byPos); }

  // ───────── Cours ─────────
  async createCourse(a: Actor, raw: unknown) {
    authorize(a, 'course.write');
    const d = this.parse(S.courseInput, raw);
    return this.repo.courses.insert({ ...d, statut: 'brouillon', instructeurId: a.id, instructeurNom: a.nom });
  }
  async updateCourse(a: Actor, id: string, raw: unknown) {
    const c = await this.course(id);
    authorizeCourse(a, 'course.write', c);
    return (await this.repo.courses.update(id, this.parse(S.coursePatch, raw)))!;
  }
  /** Publier exige au moins une leçon ; repasser en brouillon est refusé dès qu'il existe des inscrits. */
  async setCourseStatut(a: Actor, id: string, raw: unknown) {
    const { statut } = this.parse(S.statutInput, raw);
    const c = await this.course(id);
    authorizeCourse(a, 'course.write', c);
    if (statut === c.statut) return c;
    if (statut === 'publie' && !(await this.lessons(id)).length) throw conflict('Ajoutez au moins une leçon avant de publier le cours');
    if (statut === 'brouillon' && (await this.repo.enrollments.find({ courseId: id })).length) throw conflict('Ce cours a des inscrits : archivez-le plutôt que de le repasser en brouillon');
    return (await this.repo.courses.update(id, { statut: statut as CourseStatut }))!;
  }
  async listCourses(a: Actor) {
    authorize(a, 'read');
    const own = new Map((await this.mine(a)).map((e) => [e.courseId, e]));
    const mine = new Set(own.keys());
    const out = [];
    for (const c of await this.repo.courses.find()) {
      if (!(seesAll(a) || canManageCourse(a, c) || c.statut === 'publie' || (c.statut === 'archive' && mine.has(c.id)))) continue;
      const lessons = await this.lessons(c.id);
      const manage = seesAll(a) || canManageCourse(a, c);
      out.push({ ...c, nbLecons: lessons.length, dureeMin: lessons.reduce((s, l) => s + l.dureeMin, 0), inscription: own.has(c.id) ? await this.summary(own.get(c.id)!) : null, peutGerer: canManageCourse(a, c), inscrits: manage ? (await this.repo.enrollments.find({ courseId: c.id })).length : null });
    }
    return out.sort((x, y) => x.titre.localeCompare(y.titre));
  }
  /** Structure complète. Les bonnes réponses des quiz ne sortent jamais pour un apprenant ; le contenu des leçons n'est donné qu'aux inscrits et aux gestionnaires. */
  async getCourse(a: Actor, id: string) {
    authorize(a, 'read');
    const c = await this.course(id);
    await this.assertVisible(a, c);
    const manage = canManageCourse(a, c);
    const mine = (await this.mine(a, id))[0] ?? null;
    const showContent = manage || seesAll(a) || !!mine;
    const [chapters, lessons, quiz] = [await this.chapters(id), await this.lessons(id), (await this.repo.quizzes.find({ courseId: id }))[0] ?? null];
    return {
      course: c, peutGerer: manage,
      chapters: chapters.map((ch) => ({ ...ch, lessons: lessons.filter((l) => l.chapterId === ch.id).map((l) => ({ ...l, contenu: showContent ? l.contenu : '', medias: showContent ? (l.medias ?? []) : [], nbMedias: (l.medias ?? []).length })) })),
      quiz: quiz ? { ...quiz, questions: (await this.activeQuestions(quiz)).map((q) => ({ id: q.id, enonce: q.enonce, choix: q.choix, position: q.position, multiple: q.bonnes.length > 1, ...(manage || seesAll(a) ? { bonnes: q.bonnes } : {}) })) } : null,
      inscription: mine ? await this.summary(mine) : null,
    };
  }

  // ───────── Chapitres, leçons ─────────
  async addChapter(a: Actor, raw: unknown) {
    const d = this.parse(S.chapterInput, raw);
    authorizeCourse(a, 'course.write', await this.course(d.courseId));
    const last = (await this.repo.chapters.find({ courseId: d.courseId })).reduce((m, c) => Math.max(m, c.position), 0);
    return this.repo.chapters.insert({ courseId: d.courseId, titre: d.titre, position: last + 1, archive: false });
  }
  private async chapterOf(id: string) { return (await this.repo.chapters.get(id)) ?? (() => { throw notFound('Chapitre'); })(); }
  async updateChapter(a: Actor, id: string, raw: unknown) {
    const ch = await this.chapterOf(id);
    authorizeCourse(a, 'course.write', await this.course(ch.courseId));
    return (await this.repo.chapters.update(id, this.parse(S.chapterPatch, raw)))!;
  }
  async archiveChapter(a: Actor, id: string) {
    const ch = await this.chapterOf(id);
    authorizeCourse(a, 'course.write', await this.course(ch.courseId));
    return this.repo.transaction(async (r) => {
      for (const l of (await r.lessons.find({ chapterId: id })).filter((x) => !x.archive)) await r.lessons.update(l.id, { archive: true });
      return (await r.chapters.update(id, { archive: true }))!;
    });
  }
  async addLesson(a: Actor, raw: unknown) {
    const d = this.parse(S.lessonInput, raw);
    authorizeCourse(a, 'course.write', await this.course(d.courseId));
    const ch = await this.chapterOf(d.chapterId);
    if (ch.courseId !== d.courseId || ch.archive) throw invalid('Chapitre inconnu pour ce cours');
    const last = (await this.repo.lessons.find({ chapterId: d.chapterId })).reduce((m, l) => Math.max(m, l.position), 0);
    return this.repo.lessons.insert({ ...d, position: last + 1, archive: false });
  }
  private async lessonOf(id: string) { return (await this.repo.lessons.get(id)) ?? (() => { throw notFound('Leçon'); })(); }
  async updateLesson(a: Actor, id: string, raw: unknown) {
    const l = await this.lessonOf(id);
    authorizeCourse(a, 'course.write', await this.course(l.courseId));
    const p = this.parse(S.lessonPatch, raw);
    // Le contenu est revalidé avec les médias résultants : un texte ne peut être vide que si la leçon garde au moins un média.
    const medias = p.medias ?? l.medias ?? [];
    let contenu: string | undefined;
    if (p.contenu !== undefined || p.medias !== undefined) {
      const r = S.parseContenu(l.type, p.contenu ?? l.contenu, medias.length > 0);
      if (!r.ok) throw invalid(r.message);
      if (p.contenu !== undefined) contenu = r.data;
    }
    return (await this.repo.lessons.update(id, { ...p, ...(contenu !== undefined ? { contenu } : {}) }))!;
  }
  async archiveLesson(a: Actor, id: string) {
    const l = await this.lessonOf(id);
    authorizeCourse(a, 'course.write', await this.course(l.courseId));
    return (await this.repo.lessons.update(id, { archive: true }))!;
  }

  // ───────── Quiz ─────────
  /** Un quiz final par cours (créé ou mis à jour). */
  async saveQuiz(a: Actor, raw: unknown) {
    const d = this.parse(S.quizInput, raw);
    authorizeCourse(a, 'course.write', await this.course(d.courseId));
    const q = (await this.repo.quizzes.find({ courseId: d.courseId }))[0];
    const { courseId, ...patch } = d;
    return q ? (await this.repo.quizzes.update(q.id, patch))! : this.repo.quizzes.insert({ courseId, ...patch });
  }
  async addQuestion(a: Actor, raw: unknown) {
    const d = this.parse(S.questionInput, raw);
    authorizeCourse(a, 'course.write', await this.course(d.courseId));
    const quiz = (await this.repo.quizzes.find({ courseId: d.courseId }))[0] ?? (() => { throw conflict('Créez d’abord le quiz du cours'); })();
    const last = (await this.repo.questions.find({ quizId: quiz.id })).reduce((m, q) => Math.max(m, q.position), 0);
    return this.repo.questions.insert({ quizId: quiz.id, courseId: d.courseId, enonce: d.enonce, choix: d.choix, bonnes: [...d.bonnes].sort((x, y) => x - y), position: last + 1, archive: false });
  }
  private async questionOf(id: string) { return (await this.repo.questions.get(id)) ?? (() => { throw notFound('Question'); })(); }
  async updateQuestion(a: Actor, id: string, raw: unknown) {
    const q = await this.questionOf(id);
    authorizeCourse(a, 'course.write', await this.course(q.courseId));
    const m = this.parse(S.questionComplete, { enonce: q.enonce, choix: q.choix, bonnes: q.bonnes, ...(raw as object) });
    return (await this.repo.questions.update(id, { enonce: m.enonce, choix: m.choix, bonnes: [...m.bonnes].sort((x, y) => x - y) }))!;
  }
  async archiveQuestion(a: Actor, id: string) {
    const q = await this.questionOf(id);
    authorizeCourse(a, 'course.write', await this.course(q.courseId));
    return (await this.repo.questions.update(id, { archive: true }))!;
  }

  // ───────── Inscriptions et progression ─────────
  private async resolveLearner(email: string, nom: string) {
    const u = (await this.repo.users.find({ email }))[0];
    return { id: u?.id ?? guestId(email), nom: u?.nom ?? nom, email };
  }
  /** Sans nom/e-mail : auto-inscription de l'acteur. Avec nom + e-mail : un gestionnaire du cours inscrit quelqu'un (compte existant, sinon invité). */
  async enroll(a: Actor, raw: unknown) {
    const d = this.parse(S.enrollInput, raw);
    const c = await this.course(d.courseId);
    let learner: { id: string; nom: string; email: string };
    if (d.apprenantEmail) { authorizeCourse(a, 'enroll.manage', c); learner = await this.resolveLearner(d.apprenantEmail, d.apprenantNom ?? ''); }
    else { authorize(a, 'learn'); await this.assertVisible(a, c); learner = { id: a.id, nom: a.nom, email: a.email ?? (await this.repo.users.get(a.id))?.email ?? '' }; }
    if (c.statut !== 'publie') throw conflict('Ce cours n’est pas ouvert aux inscriptions');
    if ((await this.mine({ ...a, id: learner.id, aliases: d.apprenantEmail ? [] : a.aliases }, c.id)).length) throw conflict('Déjà inscrit à ce cours');
    return this.repo.enrollments.insert({ courseId: c.id, apprenantId: learner.id, apprenantNom: learner.nom, apprenantEmail: learner.email, inscritPar: a.nom, inscritAt: this.now().toISOString(), statut: 'en_cours', termineAt: null });
  }
  private async summary(e: Enrollment): Promise<Resume> {
    const lessons = await this.lessons(e.courseId);
    const live = new Set(lessons.map((l) => l.id));
    const done = new Set((await this.repo.progressions.find({ enrollmentId: e.id })).map((p) => p.lessonId).filter((id) => live.has(id)));
    const quiz = (await this.repo.quizzes.find({ courseId: e.courseId }))[0];
    const required = !!quiz && (await this.activeQuestions(quiz)).length > 0;
    const tries = await this.repo.tentatives.find({ enrollmentId: e.id });
    const cert = (await this.repo.certificats.find({ courseId: e.courseId, apprenantId: e.apprenantId }))[0];
    return {
      enrollmentId: e.id, courseId: e.courseId, faites: done.size, total: lessons.length, pourcent: lessons.length ? Math.floor((100 * done.size) / lessons.length) : 0, leconsFaites: [...done],
      quiz: { requis: required, reussi: tries.some((t) => t.reussi), tentatives: tries.length, meilleurScore: tries.length ? Math.max(...tries.map((t) => t.score)) : null, seuil: quiz?.seuil ?? null,
        restantes: quiz && quiz.tentativesMax > 0 ? Math.max(0, quiz.tentativesMax - tries.length) : null },
      termine: e.statut === 'termine', termineAt: e.termineAt, certificatId: cert?.id ?? null, certificatCode: cert?.code ?? null,
    };
  }
  /** Cours terminé = toutes les leçons faites ET (pas de quiz OU quiz réussi). Délivre alors le certificat, une seule fois. */
  private async refresh(e: Enrollment): Promise<Resume> {
    const s = await this.summary(e);
    if (e.statut === 'termine' || !(s.total > 0 && s.faites === s.total && (!s.quiz.requis || s.quiz.reussi))) return s;
    const course = await this.course(e.courseId);
    const updated = await this.repo.transaction(async (r) => {
      const done = (await r.enrollments.update(e.id, { statut: 'termine', termineAt: this.now().toISOString() }))!;
      if (!(await r.certificats.find({ courseId: e.courseId, apprenantId: e.apprenantId })).length) {
        let code = newCode();
        while ((await r.certificats.find({ code })).length) code = newCode();
        const base = { code, courseId: e.courseId, apprenantId: e.apprenantId, apprenantNom: e.apprenantNom, coursTitre: course.titre, delivreAt: this.now().toISOString() };
        await r.certificats.insert({ ...base, hash: certHash(base) });
      }
      return done;
    });
    return this.summary(updated);
  }
  async getEnrollment(a: Actor, id: string) {
    authorize(a, 'read');
    const e = await this.enrollment(id);
    const c = await this.course(e.courseId);
    if (!(this.owns(a, e.apprenantId) || seesAll(a) || canManageCourse(a, c))) throw forbidden('Cette inscription ne fait pas partie de votre périmètre');
    return { enrollment: e, coursTitre: c.titre, resume: await this.summary(e) };
  }
  async listEnrollments(a: Actor, courseId?: string) {
    authorize(a, 'read');
    const courses = new Map((await this.repo.courses.find()).map((c) => [c.id, c]));
    const out = [];
    for (const e of await this.repo.enrollments.find(courseId ? { courseId } : {})) {
      const c = courses.get(e.courseId);
      if (!c || !(this.owns(a, e.apprenantId) || seesAll(a) || canManageCourse(a, c))) continue;
      out.push({ ...e, coursTitre: c.titre, resume: await this.summary(e) });
    }
    return out.sort((x, y) => x.coursTitre.localeCompare(y.coursTitre) || x.apprenantNom.localeCompare(y.apprenantNom));
  }
  /** Terminer une leçon : l'apprenant pour lui-même, ou un gestionnaire du cours pour lui (formation en présentiel). Idempotent. */
  async completeLesson(a: Actor, raw: unknown) {
    const d = this.parse(S.completeInput, raw);
    const e = await this.enrollment(d.enrollmentId);
    const c = await this.course(e.courseId);
    const self = this.owns(a, e.apprenantId) && can(a, 'learn');
    if (!self && !(can(a, 'enroll.manage') && canManageCourse(a, c))) throw forbidden('Vous ne pouvez pas enregistrer la progression de cet apprenant');
    const l = await this.lessonOf(d.lessonId);
    if (l.courseId !== e.courseId || !(await this.lessons(e.courseId)).some((x) => x.id === l.id)) throw invalid('Leçon inconnue pour ce cours');
    if (!(await this.repo.progressions.find({ enrollmentId: e.id, lessonId: l.id })).length) {
      try { await this.repo.progressions.insert({ enrollmentId: e.id, courseId: e.courseId, apprenantId: e.apprenantId, lessonId: l.id, faitAt: this.now().toISOString(), saisiPar: a.nom }); }
      catch (err) { if (!(err instanceof Error && err.name === 'LmsError')) throw err; } // course perdue contre un doublon : déjà enregistré
    }
    return this.refresh(e);
  }
  /** Quiz : l'apprenant répond lui-même (ou le formateur saisit ses réponses papier s'il n'a pas de compte) ; le score est calculé ici, jamais dans le navigateur. */
  async submitQuiz(a: Actor, raw: unknown) {
    const d = this.parse(S.submitInput, raw);
    const e = await this.enrollment(d.enrollmentId);
    const self = this.owns(a, e.apprenantId) && can(a, 'learn');
    if (!self && !(can(a, 'enroll.manage') && canManageCourse(a, await this.course(e.courseId)))) throw forbidden('Seul l’apprenant inscrit (ou le formateur du cours, pour un apprenant sans compte) peut passer ce quiz');
    const quiz = (await this.repo.quizzes.find({ courseId: e.courseId }))[0];
    const questions = quiz ? await this.activeQuestions(quiz) : [];
    if (!quiz || !questions.length) throw conflict('Ce cours n’a pas de quiz');
    const before = await this.summary(e);
    if (before.faites < before.total) throw conflict('Terminez toutes les leçons avant de passer le quiz');
    const tries = await this.repo.tentatives.find({ enrollmentId: e.id });
    if (quiz.tentativesMax > 0 && tries.length >= quiz.tentativesMax) throw conflict('Nombre maximal de tentatives atteint');
    if (d.reponses.length !== questions.length) throw invalid('Répondez à toutes les questions');
    const details = questions.map((q, i) => {
      const given = new Set(d.reponses[i]);
      if ([...given].some((x) => x >= q.choix.length)) throw invalid('Réponse hors des choix proposés');
      return { questionId: q.id, correct: given.size === q.bonnes.length && q.bonnes.every((b) => given.has(b)) };
    });
    const score = Math.round((100 * details.filter((x) => x.correct).length) / details.length);
    const reussi = score >= quiz.seuil;
    await this.repo.tentatives.insert({ quizId: quiz.id, courseId: e.courseId, enrollmentId: e.id, apprenantId: e.apprenantId, numero: tries.length + 1, passeAt: this.now().toISOString(), score, reussi, reponses: d.reponses });
    const resume = await this.refresh(e);
    return { score, reussi, seuil: quiz.seuil, tentative: tries.length + 1, details, resume };
  }

  // ───────── Import / export CSV ─────────
  /** Export du suivi (dans le périmètre de l'acteur) : un cours ou tous. Les cellules commençant par = + - @ sont neutralisées (injection de formules Excel). */
  async exportInscriptionsCsv(a: Actor, courseId?: string) {
    const rows: unknown[][] = [['Apprenant', 'E-mail', 'Cours', 'Inscrit le', 'Leçons faites', 'Leçons au total', 'Progression %', 'Meilleur score quiz %', 'Statut', 'Terminé le', 'Code certificat']];
    for (const e of await this.listEnrollments(a, courseId)) {
      rows.push([e.apprenantNom, e.apprenantEmail, e.coursTitre, dayOf(e.inscritAt), e.resume.faites, e.resume.total, e.resume.pourcent, e.resume.quiz.meilleurScore ?? '', e.statut === 'termine' ? 'Terminé' : 'En cours', dayOf(e.termineAt), e.resume.certificatCode ?? '']);
    }
    return toCsv(rows);
  }
  async exportCertificatsCsv(a: Actor) {
    const rows: unknown[][] = [['Apprenant', 'Cours', 'Délivré le', 'Code', 'Intégrité']];
    for (const c of await this.listCertificats(a)) rows.push([c.apprenantNom, c.coursTitre, dayOf(c.delivreAt), c.code, c.integre ? 'Intact' : 'Altéré']);
    return toCsv(rows);
  }
  /**
   * Import d'apprenants dans un cours publié (CSV ou Excel converti en CSV côté navigateur) : colonnes Nom, Prénom (facultatif), E-mail.
   * Passe par `enroll` : mêmes règles que l'inscription manuelle (compte existant retrouvé par e-mail, sinon invité).
   * `dryRun` valide sans rien écrire. Les lignes déjà inscrites ou en double dans le fichier sont signalées, jamais réinscrites.
   */
  async importInscriptions(a: Actor, raw: unknown): Promise<ImportReport> {
    const d = this.parse(S.importInput, raw);
    const c = await this.course(d.courseId);
    authorizeCourse(a, 'enroll.manage', c);
    if (c.statut !== 'publie') throw conflict('Publiez le cours avant d’importer des inscrits');
    const grid = parseCsv(d.csv);
    if (grid.length < 2) throw invalid('Fichier vide ou sans en-tête');
    if (grid.length > 1001) throw invalid('Import limité à 1 000 lignes');
    const cols = grid[0].map((h) => IMPORT_HEADERS[h.trim().toLowerCase()]);
    if (!cols.includes('email') || !cols.includes('nom')) throw invalid('Colonnes « Nom » et « E-mail » obligatoires (« Prénom » facultative)');
    const report: ImportReport = { total: grid.length - 1, created: 0, duplicates: [], errors: [] };
    const seen = new Set<string>();
    for (let i = 1; i < grid.length; i++) {
      const line = i + 1;
      const rec: Partial<Record<'nom' | 'prenom' | 'email', string>> = {};
      grid[i].forEach((v, k) => { if (cols[k]) rec[cols[k]!] = v.trim(); });
      const email = (rec.email ?? '').toLowerCase();
      const input = { courseId: c.id, apprenantNom: [rec.prenom, rec.nom].filter(Boolean).join(' '), apprenantEmail: email };
      try {
        if (seen.has(email)) { report.duplicates.push({ line, email, reason: 'dans_le_fichier' }); continue; }
        if (d.dryRun) {
          const p = this.parse(S.enrollInput, input);
          const learner = await this.resolveLearner(p.apprenantEmail!, p.apprenantNom ?? '');
          if ((await this.mine({ ...a, id: learner.id, aliases: [] }, c.id)).length) throw conflict('Déjà inscrit à ce cours');
        } else await this.enroll(a, input);
        seen.add(email);
        report.created++;
      } catch (e) {
        if (e instanceof LmsError && e.code === 'conflict') { seen.add(email); report.duplicates.push({ line, email, reason: 'deja_inscrit' }); }
        else report.errors.push({ line, message: e instanceof LmsError ? e.message : 'Ligne invalide' });
      }
    }
    return report;
  }

  // ───────── Certificats ─────────
  private certOk = (c: Certificat) => certHash(c) === c.hash;
  async listCertificats(a: Actor) {
    authorize(a, 'read');
    const courses = new Map((await this.repo.courses.find()).map((c) => [c.id, c]));
    return (await this.repo.certificats.find())
      .filter((c) => this.owns(a, c.apprenantId) || seesAll(a) || (courses.get(c.courseId) && canManageCourse(a, courses.get(c.courseId)!)))
      .map((c) => ({ id: c.id, code: c.code, apprenantNom: c.apprenantNom, coursTitre: c.coursTitre, delivreAt: c.delivreAt, integre: this.certOk(c) }));
  }
  /** Vérification publique : renvoie seulement le nom, le cours et la date — jamais l'e-mail. */
  async verifyCertificat(rawCode: unknown) {
    const code = this.parse(S.codeInput, rawCode);
    const c = (await this.repo.certificats.find({ code }))[0];
    return c && this.certOk(c) ? { valide: true, apprenantNom: c.apprenantNom, coursTitre: c.coursTitre, delivreAt: c.delivreAt } : { valide: false };
  }
  async certificatPdf(a: Actor, id: string) {
    authorize(a, 'read');
    const c = (await this.repo.certificats.get(id)) ?? (() => { throw notFound('Certificat'); })();
    const course = await this.course(c.courseId);
    if (!(this.owns(a, c.apprenantId) || seesAll(a) || canManageCourse(a, course))) throw forbidden('Ce certificat ne fait pas partie de votre périmètre');
    if (!this.certOk(c)) throw conflict('Certificat altéré : son empreinte ne correspond plus');
    const b = this.opts.branding?.() ?? {};
    const base = (b.verifyBase ?? '').trim();
    const verifyUrl = /^https:\/\/[\x21-\x7e]+$/.test(base) ? `${base}${base.includes('?') ? '&' : '?'}code=${c.code}` : undefined;
    const pdf = certificatePdf({ nom: c.apprenantNom, cours: c.coursTitre, date: c.delivreAt, code: c.code, hash: c.hash, organisation: b.organisation?.trim() || undefined, signataire: b.signataire?.trim() || undefined, verifyUrl });
    return { filename: `certificat-${c.code}.pdf`, base64: pdf.toString('base64') };
  }

  // ───────── Tableau de bord ─────────
  async dashboard(a: Actor) {
    authorize(a, 'read');
    const courses = (await this.repo.courses.find()).filter((c) => seesAll(a) || canManageCourse(a, c));
    const ids = new Set(courses.map((c) => c.id));
    const [enrolls, progs, tries, certs] = await Promise.all([this.repo.enrollments.find(), this.repo.progressions.find(), this.repo.tentatives.find(), this.repo.certificats.find()]);
    const limit = addDays(this.today(), -this.inactiveDays);
    const rows = [];
    for (const c of courses) {
      const es = enrolls.filter((e) => e.courseId === c.id);
      const best = es.map((e) => Math.max(-1, ...tries.filter((t) => t.enrollmentId === e.id).map((t) => t.score))).filter((s) => s >= 0);
      const inactifs = es.filter((e) => e.statut === 'en_cours' && [e.inscritAt, ...progs.filter((p) => p.enrollmentId === e.id).map((p) => p.faitAt), ...tries.filter((t) => t.enrollmentId === e.id).map((t) => t.passeAt)].sort().at(-1)!.slice(0, 10) < limit).length;
      rows.push({ id: c.id, titre: c.titre, statut: c.statut, inscrits: es.length, termines: es.filter((e) => e.statut === 'termine').length, tauxAchevement: es.length ? Math.round((100 * es.filter((e) => e.statut === 'termine').length) / es.length) : 0, scoreMoyen: best.length ? Math.round(best.reduce((s, x) => s + x, 0) / best.length) : null, inactifs });
    }
    const inscr = enrolls.filter((e) => ids.has(e.courseId));
    const fin = inscr.filter((e) => e.statut === 'termine').length;
    return {
      global: { cours: courses.length, publies: courses.filter((c) => c.statut === 'publie').length, inscriptions: inscr.length, termines: fin, tauxAchevement: inscr.length ? Math.round((100 * fin) / inscr.length) : 0, certificats: certs.filter((c) => ids.has(c.courseId)).length, inactifs: rows.reduce((s, r) => s + r.inactifs, 0) },
      parCours: rows.sort((x, y) => x.titre.localeCompare(y.titre)),
    };
  }

  // ───────── Utilisateurs et authentification ─────────
  async createUser(a: Actor, raw: unknown) {
    authorize(a, 'users.manage');
    const d = this.parse(S.userInput, raw);
    if ((await this.repo.users.find({ email: d.email })).length) throw conflict('Cet e-mail est déjà utilisé');
    const u = await this.repo.users.insert({ email: d.email, nom: d.nom, role: d.role, passwordHash: hashPassword(d.password) });
    return { id: u.id, email: u.email, nom: u.nom, role: u.role };
  }
  async actorFor(userId: string): Promise<Actor> {
    const u = (await this.repo.users.get(userId)) ?? (() => { throw forbidden('Session invalide ou expirée'); })();
    return { id: u.id, nom: u.nom, role: u.role };
  }
  /** Même message pour e-mail inconnu et mot de passe faux (pas d'énumération de comptes). */
  async login(email: string, password: string) {
    const u = (await this.repo.users.find({ email: String(email).trim().toLowerCase() }))[0];
    if (!u || !verifyPassword(String(password), u.passwordHash)) throw forbidden('Identifiants incorrects');
    const actor = await this.actorFor(u.id);
    return { token: signToken(actor, this.opts.jwtSecret ?? (() => { throw new Error('LMS_JWT_SECRET manquant'); })()), actor };
  }
}
