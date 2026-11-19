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
  const B = (s: string) => Buffer.from(s, 'latin1');
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
