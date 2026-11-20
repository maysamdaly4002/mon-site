import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admin, makeService } from './helpers';
import { seedDemo } from '../seed/demo';

test('seed : 3 cours, comptes de démonstration, un certificat délivré, tableau de bord cohérent', async () => {
  const lms = await makeService();
  const { incendie, sami, amel } = await seedDemo(lms, admin);
  assert.equal((await lms.listCourses(admin)).length, 3);
  assert.equal((await lms.listCourses(amel)).length, 2, 'le brouillon est invisible pour un apprenant');
  assert.equal((await lms.listCertificats(sami)).length, 1);
  const d = await lms.dashboard(admin);
  assert.equal(d.global.certificats, 1);
  assert.equal(d.parCours.find((c) => c.id === incendie.id)?.inscrits, 2);
  const e = (await lms.listEnrollments(amel)).find((x) => x.courseId === incendie.id)!;
  assert.ok(e.resume.pourcent > 0 && !e.resume.termine);
  assert.ok((await lms.login('instructeur@demo.tn', 'Demo1234!')).token);
  assert.ok((await lms.login('auditeur@demo.tn', 'Demo1234!')).token);
});
