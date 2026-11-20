import { test } from 'node:test';
import assert from 'node:assert/strict';
import { certificatePdf, frenchDate } from '../core/pdf';

const base = { nom: 'Amel Ben Salah', cours: 'Gestion de projet', date: '2026-11-20T09:00:00.000Z', code: 'CERT-ABCDEFGH23', hash: 'a'.repeat(64) };
const text = (b: Buffer) => b.toString('latin1');

test('dates en français, « 1er » pour le premier du mois', () => {
  assert.equal(frenchDate('2026-11-20T09:00:00.000Z'), '20 novembre 2026');
  assert.equal(frenchDate('2026-01-01'), '1er janvier 2026');
  assert.equal(frenchDate('2026-08-05'), '5 août 2026');
});

test('certificat : PDF A4 paysage, une page, accents corrects, code et empreinte lisibles', () => {
  const buf = certificatePdf({ ...base, organisation: 'Académie Snapify', signataire: 'Sami Trabelsi' });
  const t = text(buf);
  assert.equal(t.slice(0, 5), '%PDF-');
  assert.ok(t.includes('/MediaBox [0 0 842 595]'));
  assert.ok(t.includes('/Count 1'));
  assert.ok(t.includes(base.code) && t.includes(base.hash));
  assert.ok(t.includes('CERTIFICAT DE R\xc9USSITE')); // « É » en WinAnsi
  assert.ok(t.includes('20 novembre 2026'));
  assert.ok(!t.includes('/Annots')); // pas d'adresse de vérification : pas de lien
});

test('certificat : lien de vérification cliquable seulement pour une adresse https sûre', () => {
  const ok = text(certificatePdf({ ...base, verifyUrl: 'https://exemple.tn/formation/verifier/?code=CERT-ABCDEFGH23' }));
  assert.ok(ok.includes('/Annots [8 0 R]') && ok.includes('/URI (https://exemple.tn/formation/verifier/?code=CERT-ABCDEFGH23)'));
  const bad = text(certificatePdf({ ...base, verifyUrl: 'javascript:alert(1)' }));
  assert.ok(!bad.includes('/Annots') && !bad.includes('/URI'));
});

test('certificat : parenthèses et antislash échappés, noms et titres très longs ne débordent pas', () => {
  const t = text(certificatePdf({ ...base, nom: 'A (B) \\ C', cours: 'Mot '.repeat(120) }));
  assert.ok(t.includes('A \\(B\\) \\\\ C'));
  assert.ok(t.includes('\x85')); // titre tronqué par « … » (WinAnsi 0x85)
  assert.ok(text(certificatePdf({ ...base, nom: 'X'.repeat(400) })).startsWith('%PDF-')); // police réduite, pas d'exception
});

test('certificat : QR code de vérification dessiné seulement avec une adresse https sûre', () => {
  const url = 'https://exemple.tn/formation/verifier/?code=CERT-ABCDEFGH23';
  const withQr = text(certificatePdf({ ...base, verifyUrl: url }));
  assert.ok(withQr.includes('Scannez pour v\xe9rifier') && withQr.includes('1 1 1 rg')); // légende + marge blanche du QR
  const none = text(certificatePdf(base));
  assert.ok(!none.includes('Scannez pour') && !none.includes('1 1 1 rg'));
  assert.ok(!text(certificatePdf({ ...base, verifyUrl: 'javascript:alert(1)' })).includes('Scannez pour'));
  assert.ok(!text(certificatePdf({ ...base, verifyUrl: `https://exemple.tn/${'a'.repeat(300)}` })).includes('Scannez pour')); // trop long pour un QR : pas de QR, pas d'erreur
});
