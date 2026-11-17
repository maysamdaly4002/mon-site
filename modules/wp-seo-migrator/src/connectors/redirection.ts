/** Redirection (J. Godley) JSON/CSV + Simple 301-like CSV */
import type { AnalyzeContext, ExtractResult, RedirectRecord, SeoConnector } from '../types';
import { pathFromUrl, safeJson } from './utils';

export const redirectionConnector: SeoConnector = {
  id: 'redirection',
  name: 'Redirections',
  fields: ['redirects'],
  detect: (ctx) => {
    const hit = ctx.textFiles.some((f) => {
      const t = f.text.slice(0, 800).toLowerCase();
      return (
        t.includes('"url"') && t.includes('"action_data"') ||
        t.includes('source') && t.includes('target') ||
        f.name.includes('redirection') ||
        (t.includes('from') && t.includes('to') && f.name.endsWith('.csv'))
      );
    });
    return { id: 'redirection', name: 'Redirections', found: hit };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const redirects: RedirectRecord[] = [];
    const warnings: string[] = [];
    for (const f of ctx.textFiles) {
      const json = safeJson<{ redirects?: { url?: string; action_data?: { url?: string }; match_data?: unknown; enabled?: boolean }[] } | { url?: string; action_data?: { url?: string } }[]>(f.text);
      const list = Array.isArray(json) ? json : json?.redirects;
      if (list?.length) {
        for (const r of list) {
          const from = pathFromUrl(String(r.url || ''));
          const to = String(r.action_data?.url || '').trim();
          if (!from || !to) continue;
          redirects.push({ id: `redir:${from}`, from, to: to.startsWith('http') ? to : pathFromUrl(to), permanent: true, source: 'redirection' });
        }
        continue;
      }
      if (f.name.endsWith('.csv') || f.text.includes(',')) {
        const lines = f.text.split(/\r?\n/).filter(Boolean);
        const header = (lines[0] || '').toLowerCase();
        if (!(header.includes('source') || header.includes('from') || header.includes('url'))) continue;
        const cols = lines[0].split(',').map((c) => c.trim().toLowerCase().replace(/"/g, ''));
        const iFrom = cols.findIndex((c) => ['source', 'from', 'url', 'old'].includes(c));
        const iTo = cols.findIndex((c) => ['target', 'to', 'new', 'destination'].includes(c));
        if (iFrom < 0 || iTo < 0) continue;
        for (const line of lines.slice(1)) {
          const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
          const from = pathFromUrl(parts[iFrom] || '');
          const to = parts[iTo] || '';
          if (!from || !to) continue;
          redirects.push({
            id: `redir-csv:${from}`,
            from,
            to: to.startsWith('http') ? to : pathFromUrl(to),
            permanent: true,
            source: 'redirection-csv',
          });
        }
      }
    }
    if (!redirects.length) warnings.push('Aucune redirection trouvée dans les fichiers');
    return { records: [], redirects, warnings };
  },
};
