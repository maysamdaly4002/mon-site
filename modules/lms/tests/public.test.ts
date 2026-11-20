import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admin, actor, makeService } from './helpers';
import { LmsError } from '../core/errors';
import { seedDemo } from '../seed/demo';
import { publicRoutes, type PublicDeps, type PublicReq, type Visitor } from '../src/public-api';

const rejects = (p: Promise<unknown>, code: LmsError['code']) => assert.rejects(p, (e: unknown) => e instanceof LmsError && e.code === code);

/** Simule le module « Espace client » : `visitor` est le client connecté (ou null). */
async function setup(over: Partial<{ openEnrollment: boolean; linkByEmail: boolean; accounts: boolean }> = {}) {
  const lms = await makeService();
  const seeded = await seedDemo(lms, admin);
  const state = { visitor: null as Visitor | null, openEnrollment: over.openEnrollment ?? true, linkByEmail: over.linkByEmail ?? false, accounts: over.accounts ?? true, t: 1_000_000 };
  const deps: PublicDeps = { identify: async () => state.visitor, settings: () => ({ openEnrollment: state.openEnrollment, linkByEmail: state.linkByEmail }), accountsAvailable: () => state.accounts };
  const table = publicRoutes(lms, deps, () => state.t);
  const call = (method: 'GET' | 'POST', path: string, o: { query?: Record<string, string>; body?: unknown; ip?: string } = {}) => {
    const r = table.find((x) => x.method === method && x.path === path);
    if (!r) throw new Error(`route inconnue ${path}`);
    return r.run({ query: o.query ?? {}, body: o.body, cookies: {}, ip: o.ip ?? '1.2.3.4' } satisfies PublicReq) as Promise<any>;
  };
  const login = (id: string, nom: string, email: string) => { state.visitor = { id: `client:${id}`, nom, email }; };
  return { lms, state, call, login, table, ...seeded };
}

test('public sans compte : catalogue et plan visibles, contenu des leçons et bonnes réponses jamais', async () => {
  const { call, incendie } = await setup();
  const me = await call('GET', '/public/me');
  assert.deepEqual([me.customer, me.accountsAvailable], [null, true]);
  const cours = await call('GET', '/public/cours');
  assert.equal(cours.length, 2, 'seuls les cours publiés (pas le brouillon)');
  assert.ok(cours.every((c: any) => !('inscrits' in c) && !('peutGerer' in c) && c.inscription === null));
  const d = await call('GET', '/public/cours/detail', { query: { id: incendie.id } });
  assert.ok(d.chapters.flatMap((c: any) => c.lessons).every((l: any) => l.contenu === ''), 'pas de contenu sans inscription');
  assert.equal(JSON.stringify(d).includes('"bonnes"'), false);
  assert.equal(d.inscription, null);
});

test('public : un brouillon est introuvable ; une inscription exige un compte puis respecte le réglage d’ouverture', async () => {
  const { call, login, state, lms, incendie } = await setup();
  const brouillon = (await lms.listCourses(admin)).find((c) => c.statut === 'brouillon')!;
  await rejects(call('GET', '/public/cours/detail', { query: { id: brouillon.id } }), 'not_found');
  await rejects(call('POST', '/public/inscription', { body: { courseId: incendie.id } }), 'unauthenticated');
  await rejects(call('POST', '/public/lecon/terminer', { body: { enrollmentId: 'x', lessonId: 'y' } }), 'unauthenticated');
  await rejects(call('GET', '/public/certificats'), 'unauthenticated');
  login('c1', 'Lina Gharbi', 'lina@exemple.tn');
  state.openEnrollment = false;
  await rejects(call('POST', '/public/inscription', { body: { courseId: incendie.id } }), 'forbidden');
  state.openEnrollment = true;
  const e = await call('POST', '/public/inscription', { body: { courseId: incendie.id } });
  assert.equal(e.courseId, incendie.id);
  await rejects(call('POST', '/public/inscription', { body: { courseId: incendie.id } }), 'conflict');
  await rejects(call('POST', '/public/inscription', { body: { courseId: brouillon.id } }), 'not_found');
});

test('public : parcours complet d’un apprenant (inscription, leçons, quiz refusé puis réussi, certificat PDF, vérification)', async () => {
  const { call, login, incendie } = await setup();
  login('c1', 'Lina Gharbi', 'lina@exemple.tn');
  const e = await call('POST', '/public/inscription', { body: { courseId: incendie.id } });
  const d = await call('GET', '/public/cours/detail', { query: { id: incendie.id } });
  const lessons = d.chapters.flatMap((c: any) => c.lessons);
  assert.ok(lessons.every((l: any) => l.contenu.length > 0), 'contenu visible une fois inscrit');
  assert.equal(JSON.stringify(d).includes('"bonnes"'), false, 'même inscrit, jamais les bonnes réponses');
  let r = await call('POST', '/public/lecon/terminer', { body: { enrollmentId: e.id, lessonId: lessons[0].id } });
  assert.equal(r.pourcent, 20);
  await rejects(call('POST', '/public/quiz/soumettre', { body: { enrollmentId: e.id, reponses: [[0], [0], [0], [0]] } }), 'conflict');
  for (const l of lessons.slice(1)) r = await call('POST', '/public/lecon/terminer', { body: { enrollmentId: e.id, lessonId: l.id } });
  assert.deepEqual([r.faites, r.total, r.termine], [5, 5, false]);
  const bad = await call('POST', '/public/quiz/soumettre', { body: { enrollmentId: e.id, reponses: [[1], [1], [1], [0]] } });
  assert.deepEqual([bad.reussi, bad.score], [false, 0]);
  const ok = await call('POST', '/public/quiz/soumettre', { body: { enrollmentId: e.id, reponses: [[0], [0], [0, 2], [1]] } });
  assert.deepEqual([ok.reussi, ok.resume.termine], [true, true]);
  const certs = await call('GET', '/public/certificats');
  assert.equal(certs.length, 1);
  const pdf = await call('GET', '/public/certificat/pdf', { query: { id: certs[0].id } });
  assert.equal(Buffer.from(pdf.base64, 'base64').subarray(0, 5).toString(), '%PDF-');
  const v = await call('GET', '/public/certificat/verifier', { query: { code: certs[0].code } });
  assert.deepEqual([v.valide, v.apprenantNom], [true, 'Lina Gharbi']);
  assert.equal(JSON.stringify(v).includes('lina@'), false, 'la vérification publique ne divulgue pas l’e-mail');
  const mine = (await call('GET', '/public/cours')).find((c: any) => c.id === incendie.id);
  assert.equal(mine.inscription.termine, true);
});

test('public : aucune élévation de privilèges (champs superflus ignorés, données d’autrui inaccessibles, aucune route d’écriture de cours)', async () => {
  const { call, login, lms, table, incendie, sst } = await setup();
  assert.deepEqual(table.map((r) => r.path).filter((p) => /cours\/save|chapitre|lecon\/save|quiz\/save|question|users|statut|archive/.test(p)), []);
  login('c1', 'Lina', 'lina@exemple.tn');
  // Elle tente d'inscrire quelqu'un d'autre et de se donner un rôle : seuls courseId est lu.
  const e = await call('POST', '/public/inscription', { body: { courseId: sst.id, apprenantNom: 'Victime', apprenantEmail: 'victime@exemple.tn', role: 'admin' } });
  const row = (await lms.listEnrollments(admin, sst.id)).find((x) => x.id === e.id)!;
  assert.deepEqual([row.apprenantId, row.apprenantNom, row.apprenantEmail], ['client:c1', 'Lina', 'lina@exemple.tn']);
  // L'inscription d'Amel (déjà dans la base) n'est pas accessible à Lina.
  const amel = (await lms.listEnrollments(admin, incendie.id)).find((x) => x.apprenantNom.startsWith('Amel'))!;
  await rejects(call('POST', '/public/lecon/terminer', { body: { enrollmentId: amel.id, lessonId: amel.resume.leconsFaites[0] } }), 'forbidden');
  await rejects(call('POST', '/public/quiz/soumettre', { body: { enrollmentId: amel.id, reponses: [[0]] } }), 'forbidden');
  const sami = (await lms.listCertificats(admin))[0];
  await rejects(call('GET', '/public/certificat/pdf', { query: { id: sami.id } }), 'forbidden');
  assert.equal((await call('GET', '/public/certificats')).length, 0);
  await rejects(call('GET', '/public/certificat/verifier', { query: { code: "CERT-'; DROP TABLE" } }), 'validation');
});

test('public : une inscription faite par un formateur est retrouvée par e-mail seulement si le réglage est activé', async () => {
  const instr = actor('instructeur', 'u-instr-x', 'Formateur');
  for (const link of [false, true]) {
    const { call, login, lms, state, incendie } = await setup({ linkByEmail: link });
    const mine = (await lms.listCourses(admin)).find((c) => c.id === incendie.id)!;
    void mine;
    // Le formateur du cours (celui du seed) inscrit Hatem par e-mail ; Hatem crée ensuite un compte client.
    const owner = await lms.actorFor((await lms.login('instructeur@demo.tn', 'Demo1234!')).actor.id);
    const e = await lms.enroll(owner, { courseId: incendie.id, apprenantNom: 'Hatem Mansour', apprenantEmail: 'hatem@exemple.tn' });
    const l = (await lms.getCourse(owner, incendie.id)).chapters[0].lessons[0];
    await lms.completeLesson(owner, { enrollmentId: e.id, lessonId: l.id });
    login('c7', 'Hatem M.', 'Hatem@Exemple.TN');
    const cours = (await call('GET', '/public/cours')).find((c: any) => c.id === incendie.id);
    if (link) {
      assert.equal(cours.inscription.faites, 1, 'progression retrouvée');
      await rejects(call('POST', '/public/inscription', { body: { courseId: incendie.id } }), 'conflict'); // pas de doublon
    } else {
      assert.equal(cours.inscription, null, 'sans réglage : aucune fusion par e-mail (l’e-mail n’est pas prouvé)');
      assert.ok((await call('POST', '/public/inscription', { body: { courseId: incendie.id } })).id);
    }
    void state; void instr;
  }
});

test('public : la vérification de certificat est limitée en débit (anti-essai en série)', async () => {
  const { call, state } = await setup();
  for (let i = 0; i < 20; i++) assert.equal((await call('GET', '/public/certificat/verifier', { query: { code: 'CERT-AAAAAAAAAA' } })).valide, false);
  await rejects(call('GET', '/public/certificat/verifier', { query: { code: 'CERT-AAAAAAAAAA' } }), 'forbidden');
  assert.equal((await call('GET', '/public/certificat/verifier', { query: { code: 'CERT-AAAAAAAAAA' }, ip: '9.9.9.9' })).valide, false, 'autre adresse : autorisé');
  state.t += 61_000;
  assert.equal((await call('GET', '/public/certificat/verifier', { query: { code: 'CERT-AAAAAAAAAA' } })).valide, false, 'fenêtre écoulée : autorisé');
});

test('public : sans module Espace client, le catalogue reste consultable et l’état est signalé', async () => {
  const { call, state } = await setup({ accounts: false });
  assert.equal((await call('GET', '/public/me')).accountsAvailable, false);
  assert.ok((await call('GET', '/public/cours')).length > 0);
  void state;
});

test('public : les médias d’une leçon sont réservés aux inscrits (plan visible, adresses jamais avant inscription)', async () => {
  const { call, login, incendie } = await setup();
  const media = (d: any) => d.chapters.flatMap((c: any) => c.lessons).find((l: any) => l.titre === 'Utiliser un extincteur');
  const avant = await call('GET', '/public/cours/detail', { query: { id: incendie.id } });
  assert.deepEqual([media(avant).medias, media(avant).nbMedias], [[], 3], 'le nombre de médias est annoncé, pas leurs adresses');
  assert.equal(JSON.stringify(avant).includes('placehold.co'), false);
  login('c1', 'Lina Gharbi', 'lina@exemple.tn');
  const encore = await call('GET', '/public/cours/detail', { query: { id: incendie.id } });
  assert.deepEqual(media(encore).medias, [], 'connecté mais pas inscrit : toujours rien');
  await call('POST', '/public/inscription', { body: { courseId: incendie.id } });
  const apres = await call('GET', '/public/cours/detail', { query: { id: incendie.id } });
  assert.deepEqual(media(apres).medias.map((m: any) => m.type), ['image', 'video', 'document']);
  const table = (await setup()).table;
  assert.equal(table.some((r) => /media/.test(r.path)), false, 'aucune route publique ne modifie les médias');
});
