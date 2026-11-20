/**
 * Générateur de QR code sans dépendance (norme ISO/IEC 18004) : mode octets, correction d'erreurs M (~15 %), versions 1 à 10
 * (jusqu'à 213 octets). Suffisant pour une adresse de vérification de certificat. Renvoie la matrice des modules
 * (`true` = module sombre) ; le dessin (PDF, SVG…) est laissé à l'appelant.
 */

/** Par version (1..10), correction M : [mots de correction par bloc, blocs courts, mots de données d'un bloc court, blocs longs]. */
const EC_M: [number, number, number, number][] = [
  [10, 1, 16, 0], [16, 1, 28, 0], [26, 1, 44, 0], [18, 2, 32, 0], [24, 2, 43, 0],
  [16, 4, 27, 0], [18, 4, 31, 0], [22, 2, 38, 2], [22, 3, 36, 2], [26, 4, 43, 1],
];
/** Centres des motifs d'alignement par version. */
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const MAX_VERSION = EC_M.length;

const dataWords = (v: number) => { const [, s, d, l] = EC_M[v - 1]; return s * d + l * (d + 1); };
/** Nombre maximal d'octets d'un QR de cette version (4 bits de mode + 8 ou 16 bits de longueur). */
const capacity = (v: number) => Math.floor((dataWords(v) * 8 - 4 - (v >= 10 ? 16 : 8)) / 8);
export const QR_MAX_BYTES = capacity(MAX_VERSION);

// ───────── Reed–Solomon sur GF(256), polynôme 0x11D ─────────
const gfMul = (x: number, y: number) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
function rsDivisor(degree: number): number[] {
  const r = new Array<number>(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) { r[j] = gfMul(r[j], root); if (j + 1 < degree) r[j] ^= r[j + 1]; }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data: number[], divisor: number[]): number[] {
  const r = new Array<number>(divisor.length).fill(0);
  for (const b of data) { const f = b ^ r.shift()!; r.push(0); divisor.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
  return r;
}

// ───────── Données : en-tête, octets, remplissage, blocs entrelacés ─────────
function codewords(bytes: Uint8Array, v: number): number[] {
  const bits: number[] = [];
  const push = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4); push(bytes.length, v >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  const total = dataWords(v) * 8;
  push(0, Math.min(4, total - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < dataWords(v); pad ^= 0xec ^ 0x11) data.push(pad);

  const [ecLen, shortBlocks, shortLen, longBlocks] = EC_M[v - 1];
  const div = rsDivisor(ecLen);
  const blocks: { data: number[]; ec: number[] }[] = [];
  let k = 0;
  for (let i = 0; i < shortBlocks + longBlocks; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1);
    const d = data.slice(k, k + len); k += len;
    blocks.push({ data: d, ec: rsRemainder(d, div) });
  }
  const out: number[] = [];
  for (let i = 0; i <= shortLen; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

// ───────── Matrice ─────────
const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (_r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function penalty(m: boolean[][]): number {
  const n = m.length; let p = 0;
  const lines: boolean[][] = [];
  for (let i = 0; i < n; i++) { lines.push(m[i]); lines.push(m.map((row) => row[i])); }
  for (const l of lines) { // règle 1 : séries de 5 modules identiques ou plus ; règle 3 : motif 1:1:3:1:1 entouré de 4 clairs
    let run = 1;
    for (let i = 1; i <= n; i++) { if (i < n && l[i] === l[i - 1]) run++; else { if (run >= 5) p += 3 + run - 5; run = 1; } }
    for (let i = 0; i + 11 <= n; i++) {
      const s = l.slice(i, i + 11).map((b) => (b ? 1 : 0)).join('');
      if (s === '10111010000' || s === '00001011101') p += 40;
    }
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3; // règle 2
  const dark = m.reduce((s, row) => s + row.filter(Boolean).length, 0);
  return p + 10 * (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1); // règle 4 : équilibre sombre / clair
}

/** Matrice du QR code pour `text` (UTF-8). Lève une erreur si le texte dépasse `QR_MAX_BYTES` octets. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let v = 1; while (v <= MAX_VERSION && capacity(v) < bytes.length) v++;
  if (v > MAX_VERSION) throw new Error(`QR code : ${bytes.length} octets, maximum ${QR_MAX_BYTES}`);
  const size = 17 + 4 * v;
  const m = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false)); // modules « fonction » : jamais masqués
  const set = (x: number, y: number, dark: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = dark; fn[y][x] = true; } };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); } // lignes de synchronisation
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) // repères de position + séparateurs
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
  const al = ALIGN[v - 1];
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const formatBits = (mask: number) => { // BCH(15,5), niveau M = 00
    const data = (0b00 << 3) | mask; let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const b = (i: number) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, b(i));
    set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
    set(8, size - 8, true); // module sombre fixe
  };
  formatBits(0); // réserve la zone (réécrite avec le bon masque plus bas)
  if (v >= 7) { // informations de version, BCH(18,6)
    let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (v << 12) | rem;
    for (let i = 0; i < 18; i++) { const bit = ((bits >>> i) & 1) !== 0, a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit); set(b, a, bit); }
  }

  const cw = codewords(bytes, v);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) { // zigzag par colonnes de 2 modules, de droite à gauche
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && i < cw.length * 8) { m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
    }
  }

  const applyMask = (k: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](y, x)) m[y][x] = !m[y][x]; };
  let best = 0, bestScore = Infinity;
  for (let k = 0; k < 8; k++) { applyMask(k); formatBits(k); const s = penalty(m); if (s < bestScore) { best = k; bestScore = s; } applyMask(k); }
  applyMask(best); formatBits(best);
  return m;
}
