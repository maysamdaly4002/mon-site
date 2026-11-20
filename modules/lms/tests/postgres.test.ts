import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { actor, admin, makeService } from './helpers';
import { seedDemo } from '../seed/demo';
import { LmsError } from '../core/errors';

/** Tests qui n'ont de sens que sur PostgreSQL : contraintes et triggers (TEST_DATABASE_URL requis). */
const url = process.env.TEST_DATABASE_URL;
const pgTest = url ? test : test.skip;
const rejects = (p: Promise<unknown>, code: LmsError['code']) => assert.rejects(p, (e: unknown) => e instanceof LmsError && e.code === code);

async function seeded() {
  const lms = await makeService();
  const s = await seedDemo(lms, admin);
  return { lms, ...s };
}

pgTest('triggers : progressions, tentatives et certificats refusent UPDATE et DELETE, même en SQL direct', async () => {
  await seeded();
  const pool = new pg.Pool({ connectionString: url });
  try {
    for (const t of ['progressions', 'tentatives', 'certificats']) {
      await assert.rejects(pool.query(`UPDATE ${t} SET created_at = now()`), /écriture seule/);
      await assert.rejects(pool.query(`DELETE FROM ${t}`), /écriture seule/);
    }
  } finally { await pool.end(); }
});

pgTest('certificat : un administrateur de base qui contourne le trigger est tout de même détecté par le hash', async () => {
  const { lms, sami } = await seeded();
  const cert = (await lms.listCertificats(sami))[0];
  assert.equal((await lms.verifyCertificat(cert.code)).valide, true);
  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query('ALTER TABLE certificats DISABLE TRIGGER certificats_append_only');
    await pool.query(`UPDATE certificats SET apprenant_nom = 'Usurpateur' WHERE code = $1`, [cert.code]);
    await pool.query('ALTER TABLE certificats ENABLE TRIGGER certificats_append_only');
  } finally { await pool.end(); }
  assert.deepEqual(await lms.verifyCertificat(cert.code), { valide: false });
  await rejects(lms.certificatPdf(sami, cert.id), 'conflict');
});

pgTest('unicité : inscription, leçon terminée, tentative et certificat ne peuvent pas être dupliqués, même en concurrence', async () => {
  const { lms, incendie, instr } = await seeded();
  const nouveau = actor('apprenant', 'u-nouveau', 'Nouveau');
  const e = await lms.enroll(nouveau, { courseId: incendie.id });
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => lms.enroll(nouveau, { courseId: incendie.id })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 0, 'déjà inscrit : aucune doublure');
  const lesson = (await lms.getCourse(nouveau, incendie.id)).chapters[0].lessons[0];
  await Promise.all(Array.from({ length: 8 }, () => lms.completeLesson(nouveau, { enrollmentId: e.id, lessonId: lesson.id })));
  assert.equal((await lms.getEnrollment(nouveau, e.id)).resume.faites, 1, '8 validations simultanées = 1 seule progression');
  const pool = new pg.Pool({ connectionString: url });
  try {
    const n = (await pool.query('SELECT count(*)::int AS n FROM progressions WHERE enrollment_id = $1', [e.id])).rows[0].n;
    assert.equal(n, 1);
    await assert.rejects(pool.query(`INSERT INTO certificats (course_id, apprenant_id, apprenant_nom, cours_titre, code, delivre_at, hash) SELECT course_id, apprenant_id, 'x', 'x', 'CERT-AAAAAAAAAA', now(), repeat('a', 64) FROM certificats LIMIT 1`), /unique/i);
    await assert.rejects(pool.query(`UPDATE enrollments SET statut = 'termine' WHERE id = $1`, [e.id]), /check/i); // terminé sans date de fin
    await assert.rejects(pool.query(`INSERT INTO lessons (course_id, chapter_id, titre, type, contenu) SELECT course_id, id, 'L', 'video', 'javascript:alert(1)' FROM chapters LIMIT 1`), /check/i);
  } finally { await pool.end(); }
  void instr;
});

pgTest('JSON et identifiants : choix, bonnes réponses et tentatives font l’aller-retour ; identifiants texte et injection SQL inoffensifs', async () => {
  const { lms, incendie, instr, amel } = await seeded();
  const q = (await lms.getCourse(instr, incendie.id)).quiz!.questions;
  assert.deepEqual(q[2].bonnes, [0, 2]);
  assert.deepEqual(q[2].choix.length, 3);
  assert.equal((await lms.listEnrollments(amel)).length, 2, 'identifiant d’apprenant (UUID texte) retrouvé');
  await rejects(lms.getCourse(admin, "x'; DROP TABLE courses; --"), 'not_found');
  await rejects(lms.getEnrollment(admin, "' OR 1=1 --"), 'not_found');
  assert.equal((await lms.listCourses(admin)).length, 3, 'rien n’a été supprimé');
  const withAnswers = await lms.submitQuiz(amel, { enrollmentId: (await lms.listEnrollments(amel)).find((e) => e.courseId === incendie.id)!.id, reponses: [[0]] }).catch((e) => e.code);
  assert.equal(withAnswers, 'conflict', 'leçons restantes');
});

pgTest('transaction : si la délivrance du certificat échoue, la fin de cours est annulée (tout ou rien)', async () => {
  const { lms, incendie, instr } = await seeded();
  const nouveau = actor('apprenant', 'u-rollback', 'Rollback');
  const e = await lms.enroll(nouveau, { courseId: incendie.id });
  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query(`CREATE OR REPLACE FUNCTION lms_boom() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'panne simulée'; END $$`);
    await pool.query('CREATE TRIGGER lms_boom_t BEFORE INSERT ON certificats FOR EACH ROW EXECUTE FUNCTION lms_boom()');
    const detail = await lms.getCourse(nouveau, incendie.id);
    const lessons = detail.chapters.flatMap((c) => c.lessons);
    for (const l of lessons) await lms.completeLesson(nouveau, { enrollmentId: e.id, lessonId: l.id });
    await assert.rejects(lms.submitQuiz(nouveau, { enrollmentId: e.id, reponses: [[0], [0], [0, 2], [1]] }), /panne simulée/);
    const row = (await pool.query('SELECT statut, termine_at FROM enrollments WHERE id = $1', [e.id])).rows[0];
    assert.deepEqual([row.statut, row.termine_at], ['en_cours', null]);
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS lms_boom_t ON certificats');
    await pool.end();
  }
  void instr;
});

pgTest('médias de leçon : aller-retour JSON dans l’ordre ; la base refuse elle-même une adresse non https, un type inconnu ou plus de 20 médias', async () => {
  const { lms, incendie, instr } = await seeded();
  const lecon = (await lms.getCourse(instr, incendie.id)).chapters[1].lessons[0]; // « Utiliser un extincteur » : 3 médias dans le jeu de démonstration
  assert.deepEqual(lecon.medias.map((m) => m.type), ['image', 'video', 'document']);
  const pool = new pg.Pool({ connectionString: url });
  try {
    const ins = (medias: unknown) => pool.query(`INSERT INTO lessons (course_id, chapter_id, titre, type, contenu, medias) SELECT course_id, id, 'L', 'texte', 'x', $1::jsonb FROM chapters LIMIT 1`, [JSON.stringify(medias)]);
    await ins([{ type: 'image', titre: 'ok', url: 'https://exemple.tn/a.png' }]);
    await assert.rejects(ins([{ type: 'image', titre: '', url: 'http://exemple.tn/a.png' }]), /lessons_medias_valid/);
    await assert.rejects(ins([{ type: 'image', titre: '', url: 'javascript:alert(1)' }]), /lessons_medias_valid/);
    await assert.rejects(ins([{ type: 'audio', titre: '', url: 'https://exemple.tn/a.mp3' }]), /lessons_medias_valid/);
    await assert.rejects(ins([{ type: 'image', titre: '' }]), /lessons_medias_valid/);
    await assert.rejects(ins([{ titre: '', url: 'https://exemple.tn/a.png' }]), /lessons_medias_valid/);
    await assert.rejects(ins(Array.from({ length: 21 }, (_, i) => ({ type: 'lien', titre: '', url: `https://exemple.tn/${i}` }))), /lessons_medias_array/);
    await assert.rejects(ins({ type: 'image', url: 'https://exemple.tn/a.png' }), /check|array/i); // un objet seul n'est pas un tableau
  } finally { await pool.end(); }
});
