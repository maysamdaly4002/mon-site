import { qrMatrix, QR_MAX_BYTES } from './qr';

/** Mini générateur PDF (texte seul, A4, polices standard) : zéro dépendance, suffisant pour exporter le registre. */
const WIN: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Œ': 0x8c };
function enc(s: string): Buffer {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const b = WIN[ch] ?? (c < 256 ? c : 0x3f);
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c); // échappe ( ) \
    out.push(b < 32 && b !== 9 ? 0x20 : b);
  }
  return Buffer.from(out);
}


const B = (s: string) => Buffer.from(s, 'latin1');
/** Assemble les objets numérotés (1..n) en un fichier PDF : en-tête, table xref, trailer (racine = objet 1). */
function assemble(objs: Buffer[]): Buffer {
  const chunks: Buffer[] = [B('%PDF-1.4\n')];
  const offsets: number[] = [];
  let pos = chunks[0].length;
  objs.forEach((o, i) => {
    offsets.push(pos);
    const c = Buffer.concat([B(`${i + 1} 0 obj\n`), o, B('\nendobj\n')]);
    chunks.push(c); pos += c.length;
  });
  const xref = [`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  chunks.push(B(`${xref}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

export interface PdfLine { text: string; bold?: boolean; size?: number }
export function textPdf(lines: (string | PdfLine)[], footer = ''): Buffer {
  const W = 595, H = 842, M = 42, LH = 11.5, perPage = Math.floor((H - 2 * M - 14) / LH);
  const MAXC = 98; // Courier 8,5 pt ≈ 5,1 pt/car. → ~100 car. sur la largeur utile
  const wrapped: PdfLine[] = [];
  for (const l of lines) {
    const o = typeof l === 'string' ? { text: l } : l;
    const max = o.bold ? (o.size && o.size > 10 ? 50 : 88) : MAXC;
    if (!o.text) { wrapped.push({ text: '' }); continue; }
    let rest = o.text;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(' ', max); if (cut < max * 0.5) cut = max;
      wrapped.push({ ...o, text: rest.slice(0, cut) }); rest = rest.slice(cut).trimStart();
    }
    wrapped.push({ ...o, text: rest });
  }
  const pages: PdfLine[][] = [];
  for (let i = 0; i < wrapped.length; i += perPage) pages.push(wrapped.slice(i, i + perPage));
  if (!pages.length) pages.push([]);

  const objs: Buffer[] = [];
  const kids = pages.map((_, k) => `${5 + 2 * k} 0 R`).join(' ');
  objs.push(B('<< /Type /Catalog /Pages 2 0 R >>'));
  objs.push(B(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`));
  objs.push(B('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'));
  objs.push(B('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  pages.forEach((pl, k) => {
    const parts: Buffer[] = [];
    let y = H - M;
    for (const l of pl) {
      y -= LH;
      if (!l.text) continue;
      parts.push(B(`BT /${l.bold ? 'F2' : 'F1'} ${l.size ?? (l.bold ? 11 : 8.5)} Tf ${M} ${y.toFixed(1)} Td (`), enc(l.text), B(') Tj ET\n'));
    }
    parts.push(B(`BT /F1 7 Tf ${M} ${M - 18} Td (`), enc(`${footer}${footer ? '  -  ' : ''}Page ${k + 1}/${pages.length}`), B(') Tj ET\n'));
    const stream = Buffer.concat(parts);
    objs.push(B(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * k} 0 R >>`));
    objs.push(Buffer.concat([B(`<< /Length ${stream.length} >>\nstream\n`), stream, B('endstream')]));
  });

  return assemble(objs);
}

// ───────────────────────── Certificat de réussite (A4 paysage) ─────────────────────────
/** Largeurs Helvetica / Helvetica-Bold (1/1000 em) pour les caractères 32..126 : sert à centrer et à ajuster le texte. */
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
type Face = 'F1' | 'F2' | 'F3';
const textWidth = (t: string, face: Face, size: number, spacing = 0) => {
  const table = face === 'F2' ? HELV_B : HELV;
  let w = 0;
  for (const ch of t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) { const c = ch.codePointAt(0)!; w += c >= 32 && c <= 126 ? table[c - 32] : 556; }
  return (w * size) / 1000 + spacing * [...t].length;
};
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const frenchDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`; };
/** Découpe un texte en lignes qui tiennent dans `maxW` ; au-delà de `maxLines`, la dernière ligne est tronquée par « … ». */
function wrapWidth(t: string, face: Face, size: number, maxW: number, maxLines: number): string[] {
  const lines: string[] = []; let cur = '';
  for (const word of t.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (textWidth(next, face, size) <= maxW || !cur) cur = next; else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    let last = lines.slice(maxLines - 1).join(' ');
    while (last.length > 1 && textWidth(`${last}…`, face, size) > maxW) last = last.slice(0, -1);
    return [...lines.slice(0, maxLines - 1), `${last.trimEnd()}…`];
  }
  return lines;
}
const SAFE_URL = /^https:\/\/[\x21-\x7e]+$/;
export interface CertificateData { nom: string; cours: string; date: string; code: string; hash: string; organisation?: string; signataire?: string; verifyUrl?: string }

export function certificatePdf(c: CertificateData): Buffer {
  const W = 842, H = 595, NAVY = '0.10 0.18 0.36', GOLD = '0.72 0.55 0.16', GREY = '0.36 0.40 0.47';
  const ops: Buffer[] = [];
  const raw = (s: string) => ops.push(B(`${s}\n`));
  const text = (t: string, x: number, y: number, face: Face, size: number, color: string, spacing = 0) => {
    ops.push(B(`BT /${face} ${size} Tf ${color} rg ${spacing} Tc ${x.toFixed(1)} ${y.toFixed(1)} Td (`), enc(t), B(') Tj ET\n'));
  };
  const centered = (t: string, y: number, face: Face, size: number, color: string, spacing = 0) => text(t, (W - textWidth(t, face, size, spacing) + spacing) / 2, y, face, size, color, spacing);
  const rect = (x: number, y: number, w: number, h: number, stroke: string, lw: number) => raw(`${stroke} RG ${lw} w ${x} ${y} ${w} ${h} re S`);
  const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, lw: number) => raw(`${stroke} RG ${lw} w ${x1} ${y1} m ${x2} ${y2} l S`);
  const circle = (cx: number, cy: number, r: number, stroke: string, lw: number) => {
    const k = 0.5523 * r;
    raw(`${stroke} RG ${lw} w ${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c S`);
  };

  // Cadre : trait marine épais, filet doré, petits carrés dorés aux angles.
  rect(22, 22, W - 44, H - 44, NAVY, 3);
  rect(31, 31, W - 62, H - 62, GOLD, 0.8);
  for (const [x, y] of [[26, 26], [W - 36, 26], [26, H - 36], [W - 36, H - 36]]) raw(`${GOLD} rg ${x} ${y} 10 10 re f`);

  if (c.organisation) centered(c.organisation.toUpperCase(), H - 92, 'F2', 11, GREY, 3);
  centered('CERTIFICAT DE RÉUSSITE', H - 150, 'F2', 34, NAVY, 2);
  line(W / 2 - 70, H - 168, W / 2 + 70, H - 168, GOLD, 1.5);
  centered('Ce certificat est décerné à', H - 203, 'F3', 13, GREY);

  const MAXW = 640;
  let nameSize = 34; while (nameSize > 16 && textWidth(c.nom, 'F2', nameSize) > MAXW) nameSize -= 1;
  const nameW = Math.min(textWidth(c.nom, 'F2', nameSize), MAXW);
  centered(c.nom, H - 250, 'F2', nameSize, NAVY);
  line(W / 2 - nameW / 2 - 24, H - 260, W / 2 + nameW / 2 + 24, H - 260, GOLD, 0.8);

  centered('pour avoir terminé avec succès la formation', H - 292, 'F3', 13, GREY);
  const courseSize = textWidth(c.cours, 'F2', 22) > MAXW * 2 ? 17 : 22;
  const courseLines = wrapWidth(c.cours, 'F2', courseSize, MAXW, 2);
  courseLines.forEach((l, i) => centered(l, H - 328 - i * (courseSize + 6), 'F2', courseSize, NAVY));
  centered(`Délivré le ${frenchDate(c.date)}`, H - 328 - courseLines.length * (courseSize + 6) - 18, 'F1', 12, GREY);

  // Bas de page : signature (gauche), sceau (centre), vérification (droite).
  const base = 112;
  line(80, base, 270, base, NAVY, 0.8);
  if (c.signataire) text(c.signataire, 80, base - 14, 'F2', 10, NAVY);
  text('Signature', 80, base - (c.signataire ? 26 : 14), 'F1', 8, GREY);
  circle(W / 2, base + 4, 38, GOLD, 2.2); circle(W / 2, base + 4, 32, GOLD, 0.8);
  centered('CERTIFIÉ', base, 'F2', 9, GOLD, 1.2);
  centered('AUTHENTIQUE', base - 11, 'F1', 6, GREY, 0.6);
  const rx = W - 80;
  const right = (t: string, y: number, face: Face, size: number, color: string) => text(t, rx - textWidth(t, face, size), y, face, size, color);
  right('Code de vérification', base + 18, 'F1', 8, GREY);
  right(c.code, base + 2, 'F2', 13, NAVY);
  let link: { x: number; y: number; w: number; h: number; url: string } | null = null;
  if (c.verifyUrl) {
    let size = 8; while (size > 5.5 && textWidth(c.verifyUrl, 'F1', size) > 270) size -= 0.5;
    const w = textWidth(c.verifyUrl, 'F1', size);
    right(c.verifyUrl, base - 14, 'F1', size, '0.10 0.30 0.65');
    link = { x: rx - w, y: base - 17, w, h: size + 4, url: c.verifyUrl };
  } else right('Vérification : page « Vérifier un certificat » du site', base - 14, 'F1', 8, GREY);
  // QR code de vérification (même adresse que le lien) : 72 pt ≈ 2,5 cm, noir sur fond blanc, aligné à droite au-dessus du code.
  if (c.verifyUrl && SAFE_URL.test(c.verifyUrl) && new TextEncoder().encode(c.verifyUrl).length <= QR_MAX_BYTES) {
    const m = qrMatrix(c.verifyUrl), n = m.length, QS = 72, mod = QS / n, qx = rx - QS, qy = base + 40;
    raw(`1 1 1 rg ${(qx - 2 * mod).toFixed(2)} ${(qy - 2 * mod).toFixed(2)} ${(QS + 4 * mod).toFixed(2)} ${(QS + 4 * mod).toFixed(2)} re f`); // marge blanche
    raw('0 0 0 rg');
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!m[y][x]) continue;
      let w = 1; while (x + w < n && m[y][x + w]) w++; // une seule barre par suite de modules sombres
      raw(`${(qx + x * mod).toFixed(2)} ${(qy + (n - 1 - y) * mod).toFixed(2)} ${(w * mod + 0.02).toFixed(2)} ${(mod + 0.02).toFixed(2)} re f`);
      x += w - 1;
    }
    right('Scannez pour vérifier', base + 28, 'F1', 6.5, GREY);
  }
  centered(`Empreinte SHA-256 : ${c.hash}`, 46, 'F1', 6.5, GREY);

  const stream = Buffer.concat(ops);
  const objs: Buffer[] = [
    B('<< /Type /Catalog /Pages 2 0 R >>'),
    B('<< /Type /Pages /Kids [6 0 R] /Count 1 >>'),
    B('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    B('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
    B('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'),
    B(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents 7 0 R${link ? ' /Annots [8 0 R]' : ''} >>`),
    Buffer.concat([B(`<< /Length ${stream.length} >>\nstream\n`), stream, B('endstream')]),
  ];
  if (link && SAFE_URL.test(link.url)) objs.push(B(`<< /Type /Annot /Subtype /Link /Rect [${link.x.toFixed(1)} ${link.y.toFixed(1)} ${(link.x + link.w).toFixed(1)} ${(link.y + link.h).toFixed(1)}] /Border [0 0 0] /A << /S /URI /URI (${link.url.replace(/[()\\]/g, '\\$&')}) >> >>`));
  else if (link) objs[5] = B(objs[5].toString('latin1').replace(' /Annots [8 0 R]', ''));
  return assemble(objs);
}
