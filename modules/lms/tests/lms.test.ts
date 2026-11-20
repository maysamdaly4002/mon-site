import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actor, admin, clock, makeService } from './helpers';
import { LmsError } from '../core/errors';
import { LmsService } from '../core/services';
import { memoryRepository } from '../core/memory';
import { signToken, verifyToken } from '../core/auth';

const rejects = (p: Promise<unknown>, code: LmsError['code']) => assert.rejects(p, (e: unknown) => e instanceof LmsError && e.code === code);
const instr = actor('instructeur', 'u-instr', 'Karim');
const autre = actor('instructeur', 'u-autre', 'Autre formateur');
const amel = actor('apprenant', 'u-amel', 'Amel');
const sami = actor('apprenant', 'u-sami', 'Sami');
const aud = actor('auditeur');

/** Cours type : 1 chapitre, 3 leçons (2 textes + 1 vidéo), quiz optionnel de 3 questions (seuil 70 %, 2 tentatives). */
async function build(lms: LmsService, o: { quiz?: boolean; publish?: boolean; owner?: typeof instr } = {}) {
  const owner = o.owner ?? instr;
  const course = await lms.createCourse(owner, { titre: 'Sécurité incendie', description: 'Bases', niveau: 'debutant' });
  const chapter = await lms.addChapter(owner, { courseId: course.id, titre: 'Introduction' });
  const lessons = [
    await lms.addLesson(owner, { courseId: course.id, chapterId: chapter.id, titre: 'Le feu', type: 'texte', contenu: 'Le triangle du feu.', dureeMin: 5 }),
    await lms.addLesson(owner, { courseId: course.id, chapterId: chapter.id, titre: 'Extincteurs', type: 'texte', contenu: 'Utiliser un extincteur.', dureeMin: 10 }),
    await lms.addLesson(owner, { courseId: course.id, chapterId: chapter.id, titre: 'Vidéo', type: 'video', contenu: 'https://www.youtube.com/watch?v=abc123', dureeMin: 8 }),
  ];
  const questions = [];
  if (o.quiz) {
    await lms.saveQuiz(owner, { courseId: course.id, titre: 'Quiz final', seuil: 70, tentativesMax: 2 });
    questions.push(await lms.addQuestion(owner, { courseId: course.id, enonce: 'Q1 ?', choix: ['A', 'B', 'C'], bonnes: [1] }));
    questions.push(await lms.addQuestion(owner, { courseId: course.id, enonce: 'Q2 (multiple) ?', choix: ['A', 'B', 'C'], bonnes: [0, 2] }));
    questions.push(await lms.addQuestion(owner, { courseId: course.id, enonce: 'Q3 ?', choix: ['Vrai', 'Faux'], bonnes: [0] }));
  }
  if (o.publish !== false) await lms.setCourseStatut(owner, course.id, { statut: 'publie' });
  return { course, chapter, lessons, questions };
}
const finishLessons = async (lms: LmsService, who: typeof amel, enrollmentId: string, lessons: { id: string }[]) => { for (const l of lessons) await lms.completeLesson(who, { enrollmentId, lessonId: l.id }); };
const GOOD = [[1], [0, 2], [0]];

test('cours : publier exige une leçon ; repasser en brouillon est refusé dès qu’il y a des inscrits', async () => {
  const lms = await makeService();
  const c = await lms.createCourse(instr, { titre: 'Vide' });
  assert.equal(c.statut, 'brouillon');
  await rejects(lms.setCourseStatut(instr, c.id, { statut: 'publie' }), 'conflict');
  const { course } = await build(lms);
  assert.equal((await lms.listCourses(admin)).find((x) => x.id === course.id)?.statut, 'publie');
  await lms.enroll(amel, { courseId: course.id });
  await rejects(lms.setCourseStatut(instr, course.id, { statut: 'brouillon' }), 'conflict');
  assert.equal((await lms.setCourseStatut(instr, course.id, { statut: 'archive' })).statut, 'archive');
});

test('droits : un instructeur ne gère que ses cours ; apprenant et auditeur ne créent ni ne modifient', async () => {
  const lms = await makeService();
  const { course, lessons } = await build(lms);
  await rejects(lms.updateCourse(autre, course.id, { titre: 'Piraté' }), 'forbidden');
  await rejects(lms.addChapter(autre, { courseId: course.id, titre: 'X' }), 'forbidden');
  await rejects(lms.archiveLesson(autre, lessons[0].id), 'forbidden');
  for (const who of [amel, aud]) {
    await rejects(lms.createCourse(who, { titre: 'Non' }), 'forbidden');
    await rejects(lms.updateCourse(who, course.id, { titre: 'Non' }), 'forbidden');
  }
  assert.equal((await lms.updateCourse(admin, course.id, { titre: 'Renommé par l’admin' })).titre, 'Renommé par l’admin');
  await rejects(lms.createUser(instr, { email: 'x@y.tn', nom: 'X', role: 'admin', password: 'Motdepasse1' }), 'forbidden');
});

test('visibilité : un brouillon est introuvable pour les autres ; contenu et bonnes réponses protégés', async () => {
  const lms = await makeService();
  const brouillon = await build(lms, { publish: false, quiz: true });
  await rejects(lms.getCourse(amel, brouillon.course.id), 'not_found');
  await rejects(lms.getCourse(autre, brouillon.course.id), 'not_found'); // un autre formateur ne voit pas non plus le brouillon
  assert.equal((await lms.listCourses(amel)).some((c) => c.id === brouillon.course.id), false);
  assert.equal((await lms.listCourses(aud)).some((c) => c.id === brouillon.course.id), true, 'l’auditeur voit tout');
  await lms.setCourseStatut(instr, brouillon.course.id, { statut: 'publie' });
  const avant = await lms.getCourse(amel, brouillon.course.id);
  assert.ok(avant.chapters[0].lessons.every((l) => l.contenu === ''), 'pas de contenu avant inscription');
  assert.equal(avant.quiz?.questions.every((q) => !('bonnes' in q)), true);
  await lms.enroll(amel, { courseId: brouillon.course.id });
  const apres = await lms.getCourse(amel, brouillon.course.id);
  assert.match(apres.chapters[0].lessons[0].contenu, /triangle/);
  assert.equal(JSON.stringify(apres).includes('"bonnes"'), false, 'les bonnes réponses ne sortent jamais vers un apprenant');
  assert.deepEqual((await lms.getCourse(instr, brouillon.course.id)).quiz?.questions[0].bonnes, [1]);
});

test('validation : adresses non https refusées, HTML retiré, questions incohérentes refusées', async () => {
  const lms = await makeService();
  const { course, chapter } = await build(lms);
  const base = { courseId: course.id, chapterId: chapter.id, titre: 'L', dureeMin: 1 };
  for (const bad of ['http://exemple.com/v', 'javascript:alert(1)', 'https://', 'ftp://x.tn/a', 'https://a b.tn/x', 'data:text/html,<script>']) await rejects(lms.addLesson(instr, { ...base, type: 'video', contenu: bad }), 'validation');
  const l = await lms.addLesson(instr, { ...base, titre: '<b>Titre</b><script>x()</script>', type: 'texte', contenu: 'Ligne 1\n<img src=x onerror=alert(1)>Ligne 2' });
  assert.equal(l.titre, 'Titrex()');
  assert.equal(l.contenu, 'Ligne 1\nLigne 2');
  await rejects(lms.addLesson(instr, { ...base, type: 'texte', contenu: '   ' }), 'validation');
  await rejects(lms.updateLesson(instr, l.id, { contenu: 'x'.repeat(20_001) }), 'validation');
  await lms.saveQuiz(instr, { courseId: course.id });
  const q = { courseId: course.id, enonce: 'Q', choix: ['A', 'B'], bonnes: [0] };
  await rejects(lms.addQuestion(instr, { ...q, bonnes: [5] }), 'validation');
  await rejects(lms.addQuestion(instr, { ...q, bonnes: [0, 1] }), 'validation'); // tout correct : question sans intérêt
  await rejects(lms.addQuestion(instr, { ...q, choix: ['A', 'a'] }), 'validation');
  await rejects(lms.addQuestion(instr, { ...q, choix: ['A'] }), 'validation');
  await rejects(lms.addQuestion(instr, { ...q, bonnes: [] }), 'validation');
  await rejects(lms.addLesson(instr, { ...base, chapterId: 'inconnu', type: 'texte', contenu: 'x' }), 'not_found');
});

test('inscription : unique, réservée aux cours publiés ; un formateur inscrit par e-mail (identifiant stable)', async () => {
  const lms = await makeService();
  const { course } = await build(lms);
  const e = await lms.enroll(amel, { courseId: course.id });
  assert.equal(e.statut, 'en_cours');
  await rejects(lms.enroll(amel, { courseId: course.id }), 'conflict');
  const draft = await build(lms, { publish: false });
  await rejects(lms.enroll(sami, { courseId: draft.course.id }), 'not_found');
  await lms.setCourseStatut(instr, draft.course.id, { statut: 'archive' });
  await rejects(lms.enroll(sami, { courseId: draft.course.id }), 'not_found');
  await rejects(lms.enroll(aud, { courseId: course.id }), 'forbidden');
  const h1 = await lms.enroll(instr, { courseId: course.id, apprenantNom: 'Hatem', apprenantEmail: ' Hatem@Exemple.TN ' });
  assert.equal(h1.apprenantEmail, 'hatem@exemple.tn');
  await rejects(lms.enroll(instr, { courseId: course.id, apprenantNom: 'Hatem', apprenantEmail: 'hatem@exemple.tn' }), 'conflict');
  await rejects(lms.enroll(autre, { courseId: course.id, apprenantNom: 'Zied', apprenantEmail: 'z@exemple.tn' }), 'forbidden');
  await rejects(lms.enroll(amel, { courseId: course.id, apprenantNom: 'Zied', apprenantEmail: 'z@exemple.tn' }), 'forbidden');
  await rejects(lms.enroll(instr, { courseId: course.id, apprenantEmail: 'seul@exemple.tn' }), 'validation');
});

test('progression : pourcentage, idempotence, leçon étrangère refusée, saisie pour autrui réservée au formateur', async () => {
  const lms = await makeService();
  const { course, lessons } = await build(lms);
  const other = await build(lms);
  const e = await lms.enroll(amel, { courseId: course.id });
  let r = await lms.completeLesson(amel, { enrollmentId: e.id, lessonId: lessons[0].id });
  assert.deepEqual([r.faites, r.total, r.pourcent, r.termine], [1, 3, 33, false]);
  r = await lms.completeLesson(amel, { enrollmentId: e.id, lessonId: lessons[0].id });
  assert.equal(r.faites, 1, 'idempotent : pas de double comptage');
  await rejects(lms.completeLesson(amel, { enrollmentId: e.id, lessonId: other.lessons[0].id }), 'validation');
  await rejects(lms.completeLesson(sami, { enrollmentId: e.id, lessonId: lessons[1].id }), 'forbidden');
  await rejects(lms.completeLesson(autre, { enrollmentId: e.id, lessonId: lessons[1].id }), 'forbidden');
  await rejects(lms.completeLesson(aud, { enrollmentId: e.id, lessonId: lessons[1].id }), 'forbidden');
  r = await lms.completeLesson(instr, { enrollmentId: e.id, lessonId: lessons[1].id });
  assert.equal(r.faites, 2, 'le formateur du cours peut saisir la présence');
  await rejects(lms.getEnrollment(sami, e.id), 'forbidden');
  assert.equal((await lms.getEnrollment(amel, e.id)).resume.faites, 2);
  assert.equal((await lms.listEnrollments(sami)).length, 0, 'un apprenant ne voit que ses inscriptions');
  assert.equal((await lms.listEnrollments(instr, course.id)).length, 1);
  assert.equal((await lms.listEnrollments(autre)).length, 0);
});

test('archivage : retirer une leçon ou un chapitre recalcule la progression sans rien supprimer', async () => {
  const lms = await makeService();
  const { course, chapter, lessons } = await build(lms);
  const e = await lms.enroll(amel, { courseId: course.id });
  await lms.completeLesson(amel, { enrollmentId: e.id, lessonId: lessons[0].id });
  await lms.archiveLesson(instr, lessons[1].id);
  let r = (await lms.getEnrollment(amel, e.id)).resume;
  assert.deepEqual([r.faites, r.total, r.pourcent], [1, 2, 50]);
  await lms.archiveLesson(instr, lessons[0].id); // la leçon terminée est archivée : elle ne compte plus
  r = (await lms.getEnrollment(amel, e.id)).resume;
  assert.deepEqual([r.faites, r.total], [0, 1]);
  await lms.archiveChapter(instr, chapter.id);
  assert.equal((await lms.getCourse(instr, course.id)).chapters.length, 0);
  assert.equal((await lms.getEnrollment(amel, e.id)).resume.total, 0);
  await rejects(lms.completeLesson(amel, { enrollmentId: e.id, lessonId: lessons[2].id }), 'validation');
});

test('quiz : leçons d’abord, score calculé par le serveur (réponses multiples), seuil et tentatives', async () => {
  const lms = await makeService();
  const { course, lessons } = await build(lms, { quiz: true });
  const e = await lms.enroll(amel, { courseId: course.id });
  await rejects(lms.submitQuiz(amel, { enrollmentId: e.id, reponses: GOOD }), 'conflict'); // leçons non terminées
  await finishLessons(lms, amel, e.id, lessons);
  assert.equal((await lms.getEnrollment(amel, e.id)).resume.termine, false, 'toutes les leçons faites mais quiz requis');
  await rejects(lms.submitQuiz(sami, { enrollmentId: e.id, reponses: GOOD }), 'forbidden');
  await rejects(lms.submitQuiz(amel, { enrollmentId: e.id, reponses: [[1]] }), 'validation');
  await rejects(lms.submitQuiz(amel, { enrollmentId: e.id, reponses: [[1], [0, 2], [9]] }), 'validation'); // réponse hors choix
  const rate = await lms.submitQuiz(amel, { enrollmentId: e.id, reponses: [[0], [0], [0]] }); // 1/3 → 33 %
  assert.deepEqual([rate.score, rate.reussi, rate.tentative], [33, false, 1]);
  assert.equal(JSON.stringify(rate).includes('bonnes'), false, 'le résultat ne révèle pas les bonnes réponses');
  assert.equal(rate.resume.quiz.restantes, 1);
  const partiel = await lms.submitQuiz(amel, { enrollmentId: e.id, reponses: [[1], [0], [0]] }); // Q2 multiple incomplète = fausse
  assert.deepEqual([partiel.score, partiel.reussi], [67, false]);
  await rejects(lms.submitQuiz(amel, { enrollmentId: e.id, reponses: GOOD }), 'conflict'); // 2 tentatives max
  assert.equal((await lms.getEnrollment(amel, e.id)).resume.termine, false);

  const e2 = await lms.enroll(sami, { courseId: course.id });
  await finishLessons(lms, sami, e2.id, lessons);
  const ok = await lms.submitQuiz(sami, { enrollmentId: e2.id, reponses: GOOD });
  assert.deepEqual([ok.score, ok.reussi, ok.resume.termine], [100, true, true]);
  assert.match(ok.resume.certificatCode ?? '', /^CERT-[A-Z0-9]{10}$/);
});

test('certificat : délivré une seule fois à la fin, vérifiable publiquement sans fuite de données', async () => {
  const lms = await makeService();
  const { course, lessons } = await build(lms);
  const e = await lms.enroll(amel, { courseId: course.id });
  await finishLessons(lms, amel, e.id, lessons.slice(0, 2));
  assert.equal((await lms.listCertificats(amel)).length, 0);
  const fin = await lms.completeLesson(amel, { enrollmentId: e.id, lessonId: lessons[2].id });
  assert.equal(fin.termine, true);
  await lms.completeLesson(amel, { enrollmentId: e.id, lessonId: lessons[2].id }); // rejouer ne crée pas de second certificat
  const certs = await lms.listCertificats(amel);
  assert.equal(certs.length, 1);
  assert.equal(certs[0].integre, true);
  const v = await lms.verifyCertificat(certs[0].code.toLowerCase());
  assert.deepEqual(v, { valide: true, apprenantNom: 'Amel', coursTitre: 'Sécurité incendie', delivreAt: certs[0].delivreAt });
  assert.deepEqual(await lms.verifyCertificat('CERT-AAAAAAAAAA'), { valide: false });
  await rejects(lms.verifyCertificat("CERT-'; DROP TABLE"), 'validation');
  assert.equal((await lms.listCertificats(sami)).length, 0);
  assert.equal((await lms.listCertificats(instr)).length, 1);
  assert.equal((await lms.listCertificats(autre)).length, 0, 'un autre formateur ne voit pas les certificats de ce cours');
});

test('certificat : toute altération en base est détectée (vérification et PDF refusés)', async () => {
  const repo = memoryRepository();
  const lms = new LmsService(repo, { jwtSecret: 'x' });
  const { course, lessons } = await build(lms);
  const e = await lms.enroll(amel, { courseId: course.id });
  await finishLessons(lms, amel, e.id, lessons);
  const cert = (await repo.certificats.find())[0];
  assert.equal((await lms.verifyCertificat(cert.code)).valide, true);
  await repo.certificats.update(cert.id, { apprenantNom: 'Quelqu’un d’autre' });
  assert.deepEqual(await lms.verifyCertificat(cert.code), { valide: false });
  await rejects(lms.certificatPdf(amel, cert.id), 'conflict');
  assert.equal((await lms.listCertificats(admin))[0].integre, false);
});

test('certificat PDF : valide, réservé au titulaire, au formateur du cours et aux administrateurs', async () => {
  const lms = await makeService();
  const { course, lessons } = await build(lms);
  const e = await lms.enroll(amel, { courseId: course.id });
  await finishLessons(lms, amel, e.id, lessons);
  const cert = (await lms.listCertificats(amel))[0];
  const pdf = await lms.certificatPdf(amel, cert.id);
  const buf = Buffer.from(pdf.base64, 'base64');
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buf.toString('latin1').includes(cert.code));
  assert.match(pdf.filename, /^certificat-CERT-/);
  for (const ok of [instr, admin, aud]) assert.ok((await lms.certificatPdf(ok, cert.id)).base64);
  for (const no of [sami, autre]) await rejects(lms.certificatPdf(no, cert.id), 'forbidden');
  await rejects(lms.certificatPdf(amel, 'inconnu'), 'not_found');
});

test('certificat PDF : habillage (organisme, signataire, lien de vérification) lu à chaque génération', async () => {
  let branding: { organisation?: string; signataire?: string; verifyBase?: string } = {};
  const lms = await makeService({ branding: () => branding });
  const { course, lessons } = await build(lms);
  const e = await lms.enroll(amel, { courseId: course.id });
  await finishLessons(lms, amel, e.id, lessons);
  const cert = (await lms.listCertificats(amel))[0];
  const plain = Buffer.from((await lms.certificatPdf(amel, cert.id)).base64, 'base64').toString('latin1');
  assert.ok(!plain.includes('/Annots'));
  branding = { organisation: 'Académie Test', signataire: 'Sami Trabelsi', verifyBase: 'https://exemple.tn/formation/verifier/' };
  const t = Buffer.from((await lms.certificatPdf(amel, cert.id)).base64, 'base64').toString('latin1');
  assert.ok(t.includes('ACAD\xc9MIE TEST') && t.includes('Sami Trabelsi'));
  assert.ok(t.includes(`https://exemple.tn/formation/verifier/?code=${cert.code}`));
  branding = { verifyBase: 'http://pas-https.tn/' }; // http:// refusé : pas de lien
  assert.ok(!Buffer.from((await lms.certificatPdf(amel, cert.id)).base64, 'base64').toString('latin1').includes('/Annots'));
});

test('import CSV : apprenants inscrits, doublons et lignes invalides signalés ; la simulation n’écrit rien', async () => {
  const lms = await makeService();
  const { course } = await build(lms);
  const csv = 'Nom;Prénom;E-mail\r\nBen Ali;Amel;amel@exemple.tn\r\nTrabelsi;Sami;sami@exemple.tn\r\nBen Ali;Amel;AMEL@exemple.tn\r\nX;Y;pas-un-email\r\n';
  const dry = await lms.importInscriptions(instr, { courseId: course.id, csv, dryRun: true });
  assert.deepEqual([dry.total, dry.created, dry.duplicates.length, dry.errors.length], [4, 2, 1, 1]);
  assert.equal((await lms.listEnrollments(instr, course.id)).length, 0);
  const r = await lms.importInscriptions(instr, { courseId: course.id, csv });
  assert.deepEqual([r.created, r.duplicates.map((d) => d.reason), r.errors.map((e) => e.line)], [2, ['dans_le_fichier'], [5]]);
  const list = await lms.listEnrollments(instr, course.id);
  assert.deepEqual(list.map((e) => e.apprenantNom).sort(), ['Amel Ben Ali', 'Sami Trabelsi']);
  const again = await lms.importInscriptions(instr, { courseId: course.id, csv });
  assert.equal(again.created, 0);
  assert.deepEqual(again.duplicates.map((d) => d.reason), ['deja_inscrit', 'deja_inscrit', 'dans_le_fichier']);
  assert.equal((await lms.listEnrollments(instr, course.id)).length, 2);
});

test('import CSV : réservé au formateur du cours, cours publié, colonnes obligatoires', async () => {
  const lms = await makeService();
  const { course } = await build(lms);
  const csv = 'Nom,E-mail\nBen Ali,amel@exemple.tn\n';
  for (const no of [autre, amel, aud]) await rejects(lms.importInscriptions(no, { courseId: course.id, csv }), 'forbidden');
  assert.equal((await lms.importInscriptions(admin, { courseId: course.id, csv })).created, 1);
  const draft = await build(lms, { publish: false });
  await rejects(lms.importInscriptions(instr, { courseId: draft.course.id, csv }), 'conflict');
  await rejects(lms.importInscriptions(instr, { courseId: course.id, csv: 'Prénom\nAmel\n' }), 'validation');
  await rejects(lms.importInscriptions(instr, { courseId: course.id, csv: 'Nom,E-mail\n' }), 'validation');
});

test('export CSV : suivi limité au périmètre, formules neutralisées', async () => {
  const lms = await makeService();
  const { course, lessons } = await build(lms);
  const e = await lms.enroll(instr, { courseId: course.id, apprenantNom: '=CMD() Injection', apprenantEmail: 'inj@exemple.tn' });
  await lms.enroll(amel, { courseId: course.id });
  await finishLessons(lms, amel, (await lms.listEnrollments(amel))[0].id, lessons);
  const csv = await lms.exportInscriptionsCsv(instr, course.id);
  assert.match(csv, /^Apprenant,E-mail,Cours,/);
  assert.ok(csv.includes("'=CMD() Injection") && !csv.includes(',=CMD()') && !csv.startsWith('=CMD'));
  assert.ok(csv.includes('Terminé') && csv.includes('CERT-'));
  assert.equal((await lms.exportInscriptionsCsv(amel)).trim().split('\r\n').length, 2); // en-tête + sa propre ligne
  assert.equal((await lms.exportInscriptionsCsv(autre, course.id)).trim().split('\r\n').length, 1); // aucun accès au cours d'un autre formateur
  assert.ok((await lms.exportCertificatsCsv(admin)).includes('Intact'));
  void e;
});

test('tableau de bord : inscrits, achèvement, score moyen, apprenants inactifs ; limité aux cours du formateur', async () => {
  const c = clock('2026-11-01');
  const lms = await makeService({ now: c.now });
  const a = await build(lms, { quiz: true });
  const b = await build(lms, { owner: autre });
  const e1 = await lms.enroll(amel, { courseId: a.course.id });
  await finishLessons(lms, amel, e1.id, a.lessons);
  await lms.submitQuiz(amel, { enrollmentId: e1.id, reponses: GOOD });
  const e2 = await lms.enroll(sami, { courseId: a.course.id });
  await lms.completeLesson(sami, { enrollmentId: e2.id, lessonId: a.lessons[0].id });
  await lms.enroll(sami, { courseId: b.course.id });
  c.set('2026-11-20'); // 19 jours plus tard : Sami n'a plus bougé depuis 14 jours
  const d = await lms.dashboard(instr);
  assert.equal(d.parCours.length, 1);
  assert.deepEqual(d.parCours[0], { id: a.course.id, titre: 'Sécurité incendie', statut: 'publie', inscrits: 2, termines: 1, tauxAchevement: 50, scoreMoyen: 100, inactifs: 1 });
  assert.deepEqual([d.global.cours, d.global.inscriptions, d.global.certificats, d.global.inactifs], [1, 2, 1, 1]);
  assert.equal((await lms.dashboard(admin)).global.cours, 2);
});

test('authentification : mot de passe haché, jeton signé et expirant, message identique en cas d’échec', async () => {
  const lms = await makeService();
  await lms.createUser(admin, { email: 'Karim@Demo.TN', nom: 'Karim', role: 'instructeur', password: 'Demo1234!' });
  await rejects(lms.createUser(admin, { email: 'karim@demo.tn', nom: 'Bis', role: 'apprenant', password: 'Demo1234!' }), 'conflict');
  await rejects(lms.createUser(admin, { email: 'x@demo.tn', nom: 'X', role: 'apprenant', password: 'court' }), 'validation');
  const { token, actor: a } = await lms.login('karim@demo.tn', 'Demo1234!');
  assert.equal(a.role, 'instructeur');
  assert.deepEqual(verifyToken(token, 'test-secret'), a);
  assert.throws(() => verifyToken(token, 'autre-secret'), /Session invalide/);
  assert.throws(() => verifyToken(token.slice(0, -2) + 'xx', 'test-secret'), /Session invalide/);
  assert.throws(() => verifyToken(signToken(a, 'test-secret', 60, Date.now() - 120_000), 'test-secret'), /Session invalide/);
  const m1 = await lms.login('karim@demo.tn', 'faux').catch((e) => e.message), m2 = await lms.login('inconnu@demo.tn', 'Demo1234!').catch((e) => e.message);
  assert.equal(m1, m2);
  const { actor: b } = await lms.login('karim@demo.tn', 'Demo1234!');
  const mine = await lms.createCourse(b, { titre: 'Cours du compte' }); // l'identifiant du jeton devient propriétaire
  assert.equal(mine.instructeurId, a.id);
});

test('inscription par e-mail d’un compte existant : le compte est retrouvé (même identité que la connexion)', async () => {
  const lms = await makeService();
  const u = await lms.createUser(admin, { email: 'amel@demo.tn', nom: 'Amel Ben Salah', role: 'apprenant', password: 'Demo1234!' });
  const { course } = await build(lms);
  const e = await lms.enroll(instr, { courseId: course.id, apprenantNom: 'Nom saisi', apprenantEmail: 'amel@demo.tn' });
  assert.equal(e.apprenantId, u.id);
  assert.equal(e.apprenantNom, 'Amel Ben Salah');
  const me = await lms.actorFor(u.id);
  assert.equal((await lms.listEnrollments(me)).length, 1);
});

// ───────── Médias multiples par leçon ─────────
const MEDIAS = [
  { type: 'video', titre: 'Démonstration', url: 'https://www.youtube.com/watch?v=abc123' },
  { type: 'image', titre: 'Schéma', url: 'https://exemple.tn/schema.png' },
  { type: 'document', titre: '<b>Fiche</b> PDF', url: 'https://exemple.tn/fiche.pdf' },
  { type: 'lien', url: 'https://exemple.tn/ressources' },
] as const;

test('médias : une leçon peut porter plusieurs médias, dans l’ordre, titres nettoyés', async () => {
  const lms = await makeService();
  const { course, chapter } = await build(lms);
  const l = await lms.addLesson(instr, { courseId: course.id, chapterId: chapter.id, titre: 'Multimédia', type: 'texte', contenu: 'Intro', dureeMin: 5, medias: MEDIAS });
  assert.deepEqual(l.medias.map((m) => m.type), ['video', 'image', 'document', 'lien']);
  assert.equal(l.medias[2].titre, 'Fiche PDF', 'HTML retiré du titre');
  assert.equal(l.medias[3].titre, '', 'titre facultatif');
  const relue = (await lms.getCourse(instr, course.id)).chapters[0].lessons.find((x) => x.id === l.id)!;
  assert.deepEqual(relue.medias, l.medias);
  // sans `medias`, une leçon n’en a aucun (comportement d’avant)
  const simple = await lms.addLesson(instr, { courseId: course.id, chapterId: chapter.id, titre: 'Simple', type: 'texte', contenu: 'x' });
  assert.deepEqual(simple.medias, []);
});

test('médias : adresses non https, type inconnu, adresse vide et plus de 20 médias sont refusés', async () => {
  const lms = await makeService();
  const { course, chapter } = await build(lms);
  const base = { courseId: course.id, chapterId: chapter.id, titre: 'L', type: 'texte' as const, contenu: 'x' };
  for (const url of ['http://exemple.tn/a.png', 'javascript:alert(1)', 'data:text/html,<script>', 'https://', 'https://a b.tn/x', '']) await rejects(lms.addLesson(instr, { ...base, medias: [{ type: 'image', url }] }), 'validation');
  await rejects(lms.addLesson(instr, { ...base, medias: [{ type: 'audio', url: 'https://exemple.tn/a.mp3' }] }), 'validation');
  await rejects(lms.addLesson(instr, { ...base, medias: [{ type: 'image' }] }), 'validation');
  const vingt = Array.from({ length: 20 }, (_, i) => ({ type: 'lien', url: `https://exemple.tn/${i}` }));
  assert.equal((await lms.addLesson(instr, { ...base, medias: vingt })).medias.length, 20);
  await rejects(lms.addLesson(instr, { ...base, medias: [...vingt, { type: 'lien', url: 'https://exemple.tn/21' }] }), 'validation');
  const l = await lms.addLesson(instr, { ...base, medias: [MEDIAS[0]] });
  await rejects(lms.updateLesson(instr, l.id, { medias: [{ type: 'image', url: 'http://exemple.tn/a.png' }] }), 'validation');
  assert.equal((await lms.getCourse(instr, course.id)).chapters[0].lessons.find((x) => x.id === l.id)!.medias.length, 1, 'refus = rien de modifié');
});

test('médias : modifier remplace la liste ; ne pas la fournir la conserve ; un texte vide exige au moins un média', async () => {
  const lms = await makeService();
  const { course, chapter } = await build(lms);
  const base = { courseId: course.id, chapterId: chapter.id, titre: 'L' };
  await rejects(lms.addLesson(instr, { ...base, type: 'texte', contenu: '  ', medias: [] }), 'validation');
  const l = await lms.addLesson(instr, { ...base, type: 'texte', contenu: '', medias: [MEDIAS[0], MEDIAS[1]] }); // leçon uniquement composée de médias
  assert.equal(l.contenu, '');
  const t = await lms.updateLesson(instr, l.id, { titre: 'Nouveau titre' });
  assert.deepEqual([t.titre, t.medias.length], ['Nouveau titre', 2]);
  const r = await lms.updateLesson(instr, l.id, { medias: [MEDIAS[3]] });
  assert.deepEqual(r.medias.map((m) => m.type), ['lien']);
  await rejects(lms.updateLesson(instr, l.id, { medias: [] }), 'validation'); // plus de texte ni de média
  await rejects(lms.updateLesson(instr, l.id, { contenu: '', medias: [] }), 'validation');
  await lms.updateLesson(instr, l.id, { contenu: 'Du texte', medias: [] });
  // une vidéo ou un lien garde son adresse obligatoire, avec ou sans médias
  const v = await lms.addLesson(instr, { ...base, type: 'video', contenu: 'https://www.youtube.com/watch?v=abc123', medias: [MEDIAS[1]] });
  await rejects(lms.updateLesson(instr, v.id, { contenu: '' }), 'validation');
  await rejects(lms.updateLesson(autre, l.id, { medias: [MEDIAS[0]] }), 'forbidden');
});

test('médias : réservés aux inscrits et aux gestionnaires ; le nombre de médias reste visible dans le plan', async () => {
  const lms = await makeService();
  const { course, chapter } = await build(lms);
  const l = await lms.addLesson(instr, { courseId: course.id, chapterId: chapter.id, titre: 'Multimédia', type: 'texte', contenu: 'Intro', medias: MEDIAS });
  const find = (d: Awaited<ReturnType<typeof lms.getCourse>>) => d.chapters[0].lessons.find((x) => x.id === l.id)!;
  const avant = find(await lms.getCourse(amel, course.id));
  assert.deepEqual([avant.medias, avant.contenu, avant.nbMedias], [[], '', 4]);
  assert.equal(JSON.stringify(await lms.getCourse(amel, course.id)).includes('exemple.tn/fiche.pdf'), false, 'aucune adresse de média avant inscription');
  await lms.enroll(amel, { courseId: course.id });
  assert.equal(find(await lms.getCourse(amel, course.id)).medias.length, 4);
  assert.deepEqual(find(await lms.getCourse(autre, course.id)).medias, [], 'un autre formateur, non inscrit, ne voit pas les médias');
  assert.equal(find(await lms.getCourse(aud, course.id)).medias.length, 4, 'l’auditeur lit tout');
});

test('médias : une leçon créée avant cette fonction (sans champ medias) reste lisible et modifiable', async () => {
  const repo = memoryRepository();
  const lms = new LmsService(repo, { jwtSecret: 'test-secret' });
  const { course, lessons } = await build(lms);
  await repo.lessons.update(lessons[0].id, { medias: undefined } as never); // simule une ancienne ligne
  const d = (await lms.getCourse(instr, course.id)).chapters[0].lessons[0];
  assert.deepEqual([d.medias, d.nbMedias], [[], 0]);
  await lms.enroll(amel, { courseId: course.id });
  assert.deepEqual((await lms.getCourse(amel, course.id)).chapters[0].lessons[0].medias, []);
  const m = await lms.updateLesson(instr, lessons[0].id, { dureeMin: 12 });
  assert.equal(m.dureeMin, 12);
  assert.equal((await lms.updateLesson(instr, lessons[0].id, { medias: [MEDIAS[1]] })).medias.length, 1);
});

test('cours : lien Google Meet, horaire et formulaire d’avis — validés, et réservés aux inscrits', async () => {
  const lms = await makeService();
  const { course } = await build(lms);
  const MEET = 'https://meet.google.com/abc-defg-hij';
  // Validation : seules les salles Google Meet et les adresses https:// passent.
  for (const meetUrl of ['http://meet.google.com/abc-defg-hij', 'https://zoom.us/j/123456', 'https://meet.google.com.evil.tn/abc', 'javascript:alert(1)'])
    await rejects(lms.updateCourse(instr, course.id, { meetUrl }), 'validation');
  await rejects(lms.updateCourse(instr, course.id, { feedbackUrl: 'http://forms.gle/abc' }), 'validation');
  await rejects(lms.updateCourse(autre, course.id, { meetUrl: MEET }), 'forbidden'); // un autre formateur ne peut pas y toucher
  const u = await lms.updateCourse(instr, course.id, { meetUrl: MEET, meetHoraire: '<b>Chaque mardi</b>, 18 h', feedbackUrl: 'https://forms.gle/abc123' });
  assert.equal(u.meetUrl, MEET); assert.equal(u.meetHoraire, 'Chaque mardi, 18 h'); assert.equal(u.feedbackUrl, 'https://forms.gle/abc123');
  assert.equal((await lms.updateCourse(instr, course.id, { titre: 'Nouveau titre' })).meetUrl, MEET); // une modification partielle ne l'efface pas
  // Visibilité : un visiteur voit l'horaire mais ni la salle ni le formulaire ; un inscrit et le formateur voient tout.
  const vue = async (a: typeof amel) => { const d = await lms.getCourse(a, course.id); const l = (await lms.listCourses(a)).find((c) => c.id === course.id)!; return [d.course, l]; };
  for (const c of await vue(amel)) { assert.equal(c.meetUrl, ''); assert.equal(c.feedbackUrl, ''); assert.equal(c.meetHoraire, 'Chaque mardi, 18 h'); }
  await lms.enroll(amel, { courseId: course.id });
  for (const c of await vue(amel)) { assert.equal(c.meetUrl, MEET); assert.equal(c.feedbackUrl, 'https://forms.gle/abc123'); }
  for (const c of await vue(instr)) assert.equal(c.meetUrl, MEET);
  for (const c of await vue(sami)) assert.equal(c.meetUrl, ''); // Sami n'est pas inscrit
  // Vider le champ retire la séance en direct.
  assert.equal((await lms.updateCourse(instr, course.id, { meetUrl: '', meetHoraire: '' })).meetUrl, '');
});

test('cours : un cours sans lien Meet (créé avant cette fonction) reste lisible', async () => {
  const lms = await makeService();
  const { course } = await build(lms);
  assert.equal((await lms.getCourse(amel, course.id)).course.meetUrl, '');
  assert.equal((await lms.getCourse(instr, course.id)).course.feedbackUrl, '');
});

test('vérification publique : le nom de l’organisme est renvoyé s’il est réglé, jamais l’e-mail', async () => {
  const lms = await makeService({ branding: () => ({ organisation: '  Académie Snapify  ' }) });
  const { course, lessons } = await build(lms);
  const e = await lms.enroll(amel, { courseId: course.id });
  await finishLessons(lms, amel, e.id, lessons);
  const code = (await lms.listCertificats(amel))[0].code;
  const v = await lms.verifyCertificat(code);
  assert.equal(v.valide && v.organisation, 'Académie Snapify');
  assert.equal(JSON.stringify(v).includes('@'), false);
  const sans = await (await makeService({ branding: () => ({ organisation: '   ' }) })).verifyCertificat('CERT-AAAAAAAAAA');
  assert.deepEqual(sans, { valide: false }); // code inconnu : aucun nom d'organisme n'est divulgué
});
