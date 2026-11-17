/** Groupe B — redirections .htaccess / nginx.conf */
import type { AnalyzeContext, ExtractResult, RedirectRecord, SeoConnector } from '../types';
import { pathFromUrl } from './utils';

function push(redir: RedirectRecord[], from: string, to: string, permanent: boolean, source: string) {
  if (!from || !to) return;
  redir.push({
    id: `${source}:${from}`,
    from: pathFromUrl(from),
    to: to.startsWith('http') ? to : pathFromUrl(to),
    permanent,
    source,
  });
}

export const htaccessConnector: SeoConnector = {
  id: 'htaccess',
  name: '.htaccess / nginx',
  fields: ['redirects'],
  detect: (ctx) => {
    const hit = ctx.textFiles.some((f) => {
      const n = f.name.toLowerCase();
      const t = f.text.slice(0, 400).toLowerCase();
      return n.includes('.htaccess') || n.includes('nginx') || t.includes('rewriteengine') || t.includes('rewrite ^') || t.includes('redirect 301');
    });
    return { id: 'htaccess', name: '.htaccess / nginx', found: hit };
  },
  extract: (ctx: AnalyzeContext): ExtractResult => {
    const redirects: RedirectRecord[] = [];
    const warnings: string[] = [];
    for (const f of ctx.textFiles) {
      const lines = f.text.split(/\r?\n/);
      for (const line of lines) {
        const l = line.trim();
        if (!l || l.startsWith('#')) continue;
        // Redirect 301 /old /new
        let m = /^Redirect\s+(301|302|permanent|temp)\s+(\S+)\s+(\S+)/i.exec(l);
        if (m) {
          push(redirects, m[2], m[3], /301|permanent/i.test(m[1]), 'htaccess');
          continue;
        }
        // RedirectMatch 301 ^/old$ /new
        m = /^RedirectMatch\s+(301|302)\s+(\S+)\s+(\S+)/i.exec(l);
        if (m) {
          push(redirects, m[2].replace(/^\^/, '').replace(/\$$/, ''), m[3], m[1] === '301', 'htaccess');
          continue;
        }
        // RewriteRule ^old$ /new [R=301,L]
        m = /^RewriteRule\s+(\S+)\s+(\S+)\s*\[([^\]]*)\]/i.exec(l);
        if (m && /R=\d+/i.test(m[3])) {
          const code = /R=(\d+)/i.exec(m[3])?.[1] || '302';
          push(redirects, m[1].replace(/^\^/, '').replace(/\$$/, ''), m[2], code === '301', 'htaccess');
          continue;
        }
        // nginx: rewrite ^/old$ /new permanent;
        m = /^rewrite\s+(\S+)\s+(\S+)\s+(permanent|redirect)/i.exec(l);
        if (m) {
          push(redirects, m[1].replace(/^\^/, '').replace(/\$$/, ''), m[2].replace(/;$/, ''), m[3] === 'permanent', 'nginx');
        }
      }
    }
    if (!redirects.length) warnings.push('Aucune règle de redirection dans .htaccess / nginx');
    return { records: [], redirects, warnings };
  },
};
