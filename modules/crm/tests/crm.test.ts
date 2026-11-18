import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeService } from './helpers';
import { CrmError } from '../core/errors';
import { toCsv } from '../core/csv';

const make = makeService;
const rejects = (p: Promise<unknown>, code: CrmError['code']) =>
  assert.rejects(p, (e: unknown) => e instanceof CrmError && e.code === code);

test('contact : un e-mail invalide est refusé', async () => {
  const crm = await make();
  await rejects(crm.createContact({ lastName: 'Ben Ali', email: 'pas-un-email' }), 'validation');
  await rejects(crm.createContact({ lastName: '' }), 'validation');
});

test('contact : doublon d’e-mail refusé (insensible à la casse), modification sans conflit autorisée', async () => {
  const crm = await make();
  const a = await crm.createContact({ lastName: 'Trabelsi', email: 'Sami@Example.com' });
  assert.equal(a.email, 'sami@example.com');
  await rejects(crm.createContact({ lastName: 'Autre', email: 'sami@example.com' }), 'conflict');
  const b = await crm.createContact({ lastName: 'Gharbi', email: 'b@example.com' });
  await rejects(crm.updateContact(b.id, { email: 'sami@example.com' }), 'conflict');
  const same = await crm.updateContact(a.id, { email: 'sami@example.com', phone: '+216 24 734 647' });
  assert.equal(same.phone, '+21624734647', 'téléphone normalisé');
});

test('recherche et filtres : nom (sans accents), e-mail, société (filtre), source, tag', async () => {
  const crm = await make();
  const acme = await crm.createCompany({ name: 'Acme Tunisie' });
  await crm.createContact({ firstName: 'Héla', lastName: 'Mansouri', email: 'hela@acme.tn', companyId: acme.id, source: 'formulaire', tags: ['VIP', 'vip', 'e-commerce'] });
  await crm.createContact({ firstName: 'Karim', lastName: 'Jebali', email: 'karim@x.tn', source: 'import', tags: ['prospect'] });
  assert.equal((await crm.listContacts({ q: 'hela' })).total, 1);
  assert.equal((await crm.listContacts({ q: 'acme' })).total, 1, 'recherche dans l’e-mail');
  assert.equal((await crm.listContacts({ source: 'import' })).total, 1);
  assert.equal((await crm.listContacts({ tag: 'vip' })).items[0].tags.length, 2, 'tags dédoublonnés et en minuscules');
  assert.equal((await crm.listContacts({ companyId: acme.id })).total, 1);
  assert.equal((await crm.listContacts({ size: 1 })).items.length, 1);
});

test('entreprise : plusieurs contacts rattachés ; suppression détache sans supprimer', async () => {
  const crm = await make();
  const co = await crm.createCompany({ name: 'Nova' });
  const c1 = await crm.createContact({ lastName: 'A', companyId: co.id });
  await crm.createContact({ lastName: 'B', companyId: co.id });
  assert.equal((await crm.companyDetail(co.id)).contacts.length, 2);
  await rejects(crm.createContact({ lastName: 'C', companyId: 'inconnue' }), 'validation');
  await crm.deleteCompany(co.id);
  assert.equal((await crm.getContact(c1.id)).companyId, null);
});

test('pipeline : déplacement d’étape, ordre dans la colonne, journal sur la timeline', async () => {
  const crm = await make();
  const c = await crm.createContact({ lastName: 'Client', email: 'c@x.tn' });
  const d1 = await crm.createDeal({ contactId: c.id, title: 'Site vitrine', amount: 1500 });
  const d2 = await crm.createDeal({ contactId: c.id, title: 'Boutique', amount: 4000 });
  await crm.moveDeal(d1.id, 'qualifie');
  await crm.moveDeal(d2.id, 'qualifie', 0); // passe devant d1
  const col = (await crm.pipeline()).find((s) => s.stage === 'qualifie')!;
  assert.deepEqual(col.deals.map((d) => d.title), ['Boutique', 'Site vitrine']);
  assert.equal(col.total, 5500);
  await rejects(crm.moveDeal(d1.id, 'etape_inconnue'), 'validation');
  const tl = (await crm.contactDetail(c.id)).timeline.map((a) => a.note);
  assert.ok(tl.some((n) => n.includes('Nouveau → Qualifié')));
});

test('leads : le formulaire public crée un contact avec sa source, sans doublon', async () => {
  const crm = await make();
  const r1 = await crm.captureLead({ email: 'Lead@Site.tn', name: 'Amine Ben Salah', message: 'Je veux un devis', source: 'page-contact' });
  assert.equal(r1.created, true);
  const c = (await crm.listContacts({})).items[0];
  assert.deepEqual([c.source, c.firstName, c.lastName, c.email], ['page-contact', 'Amine', 'Ben Salah', 'lead@site.tn']);
  const r2 = await crm.captureLead({ email: 'lead@site.tn', message: 'Relance' });
  assert.equal(r2.created, false);
  assert.equal((await crm.listContacts({})).total, 1);
  assert.equal((await crm.contactDetail(c.id)).timeline.length, 2);
});

test('leads : le honeypot est ignoré en silence, un e-mail invalide est refusé', async () => {
  const crm = await make();
  const r = await crm.captureLead({ email: 'bot@spam.com', website: 'http://spam' });
  assert.equal(r.ignored, true);
  assert.equal((await crm.listContacts({})).total, 0);
  await rejects(crm.captureLead({ email: 'nope' }), 'validation');
});

test('sécurité : les balises HTML sont retirées (XSS stocké) et les identifiants sont validés', async () => {
  const crm = await make();
  const c = await crm.createContact({ lastName: '<script>alert(1)</script>Dupont', email: 'x@y.tn' });
  assert.equal(c.lastName, 'alert(1)Dupont');
  await crm.addActivity(c.id, { type: 'note', note: '<img src=x onerror=alert(1)>Bonjour' });
  assert.equal((await crm.contactDetail(c.id)).timeline[0].note, 'Bonjour');
  await rejects(crm.getContact("x'; DROP TABLE contacts;--"), 'validation');
  await rejects(crm.getContact('inexistant'), 'not_found');
});

test('import CSV : détecte les doublons (fichier et base), signale les lignes invalides', async () => {
  const crm = await make();
  await crm.createContact({ lastName: 'Existant', email: 'deja@x.tn' });
  const csv = [
    'Prénom;Nom;E-mail;Téléphone;Société',
    'Ali;Nouveau;ali@x.tn;22123456;Nova',
    'Ali;Bis;ALI@x.tn;;',
    'Zed;Existant;deja@x.tn;;',
    'Bad;Mail;pas-un-mail;;',
  ].join('\n');
  const dry = await crm.importCsv(csv, { dryRun: true });
  assert.equal((await crm.listContacts({})).total, 1, 'dryRun n’écrit rien');
  assert.equal(dry.created, 1);
  const r = await crm.importCsv(csv);
  assert.deepEqual([r.created, r.duplicates.length, r.errors.length], [1, 2, 1]);
  assert.deepEqual(r.duplicates.map((d) => d.reason), ['dans_le_fichier', 'deja_en_base']);
  assert.equal(r.errors[0].line, 5);
  assert.equal((await crm.listContacts({})).total, 2);
});

test('export CSV : neutralise l’injection de formules', async () => {
  assert.ok(toCsv([['=HYPERLINK("http://evil")', 'ok']]).startsWith(`"'=HYPERLINK`));
  const crm = await make();
  await crm.createContact({ lastName: '=cmd|calc', email: 'f@x.tn' });
  assert.ok((await crm.exportCsv()).includes("'=cmd|calc"));
});

test('tableau de bord : leads par source, conversion, CA prévu', async () => {
  const crm = await make();
  const a = await crm.createContact({ lastName: 'A', source: 'formulaire' });
  await crm.createContact({ lastName: 'B', source: 'formulaire' });
  await crm.createContact({ lastName: 'C', source: 'import' });
  const won = await crm.createDeal({ contactId: a.id, title: 'W', amount: 1000 });
  const lost = await crm.createDeal({ contactId: a.id, title: 'L', amount: 500 });
  const prop = await crm.createDeal({ contactId: a.id, title: 'P', amount: 2000 });
  await crm.moveDeal(won.id, 'gagne');
  await crm.moveDeal(lost.id, 'perdu');
  await crm.moveDeal(prop.id, 'proposition');
  const d = await crm.dashboard();
  assert.deepEqual(d.leadsBySource[0], { source: 'formulaire', count: 2 });
  assert.equal(d.conversionRate, 50);
  assert.equal(d.wonRevenue, 1000);
  assert.equal(d.forecastRevenue, 1200); // 2000 × 60 %
});

test('suppression d’un contact : affaires et historique supprimés avec lui', async () => {
  const crm = await make();
  const c = await crm.createContact({ lastName: 'Tmp' });
  await crm.createDeal({ contactId: c.id, title: 'X' });
  await crm.deleteContact(c.id);
  assert.equal((await crm.pipeline()).flatMap((s) => s.deals).length, 0);
});
