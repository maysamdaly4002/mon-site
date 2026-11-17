/** Helpers parse / paths */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    if (row.some((x) => x.trim())) rows.push(row);
  }
  return rows;
}

export function csvIdx(header: string[], ...names: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const i = lower.indexOf(n.toLowerCase());
    if (i >= 0) return i;
  }
  // fuzzy contains
  for (const n of names) {
    const i = lower.findIndex((h) => h.includes(n.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}

export function decodeFile(f: { content: string; encoding: 'utf8' | 'base64' }): string {
  if (f.encoding === 'base64') {
    try {
      return Buffer.from(f.content, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
  return f.content;
}

/** Décode %xx (ex. arabe) pour affichage et chemins lisibles. */
export function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path.replace(/%[0-9A-Fa-f]{2}/g, (m) => {
      try {
        return decodeURIComponent(m);
      } catch {
        return m;
      }
    });
  }
}

export function pathFromUrl(url: string): string {
  try {
    const u = new URL(url, 'https://example.invalid');
    let p = u.pathname || '/';
    if (!p.startsWith('/')) p = `/${p}`;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return decodePath(p) || '/';
  } catch {
    const p = url.startsWith('/') ? url : `/${url}`;
    return decodePath(p.replace(/\/$/, '') || '/');
  }
}

export function slugFromPath(path: string): string {
  const seg = decodePath(path).split('/').filter(Boolean);
  return seg[seg.length - 1] || 'home';
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function safeJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function pickTextFiles(
  files: { name: string; content: string; encoding: 'utf8' | 'base64' }[]
): { name: string; text: string }[] {
  return files
    .map((f) => ({ name: f.name.toLowerCase(), text: decodeFile(f) }))
    .filter((f) => f.text.length > 0);
}
