import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, QR_MAX_BYTES } from '../core/qr';

const sizeFor = (n: number) => qrMatrix('x'.repeat(n)).length;

test('QR : la version (donc la taille) suit la longueur du texte, correction M', () => {
  assert.equal(sizeFor(1), 21);    // version 1 : 14 octets maximum
  assert.equal(sizeFor(14), 21);
  assert.equal(sizeFor(15), 25);   // version 2
  assert.equal(sizeFor(26), 25);
  assert.equal(sizeFor(27), 29);   // version 3
  assert.equal(sizeFor(62), 33);   // version 4
  assert.equal(sizeFor(122), 45);  // version 7 (informations de version)
  assert.equal(sizeFor(213), 57);  // version 10
  assert.equal(QR_MAX_BYTES, 213);
});

test('QR : trop long → erreur claire, jamais un QR faux', () => {
  assert.throws(() => qrMatrix('x'.repeat(QR_MAX_BYTES + 1)), /maximum 213/);
});

test('QR : repères de position, synchronisation et module sombre fixe présents', () => {
  const m = qrMatrix('https://exemple.tn/formation/verifier/?code=CERT-ABCDEFGH23');
  const n = m.length;
  for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3)); // 0..3 depuis le centre
      assert.equal(m[y0 + j][x0 + i], ring !== 2, `repère ${x0},${y0} module ${i},${j}`);
    }
  }
  for (let i = 8; i < n - 8; i++) assert.equal(m[6][i], i % 2 === 0); // ligne de synchronisation horizontale
  assert.equal(m[n - 8][8], true); // module sombre fixe
});

test('QR : déterministe, et deux textes différents donnent deux matrices différentes', () => {
  const a = qrMatrix('https://a.tn/?code=CERT-AAAAAAAAAA'), b = qrMatrix('https://a.tn/?code=CERT-BBBBBBBBBB');
  assert.deepEqual(a, qrMatrix('https://a.tn/?code=CERT-AAAAAAAAAA'));
  assert.notDeepEqual(a, b);
});
