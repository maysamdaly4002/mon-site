/**
 * Snapify — module Boutique
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a', 'span', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const VOID_TAGS = new Set(['br', 'hr']);

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Description produit : seules des balises de mise en forme sont conservées, sans attributs hormis
 * les liens (http, https, adresses internes, mailto, tel). Scripts, styles et cadres sont retirés avec leur contenu.
 */
export function cleanHtml(html: string): string {
  const withoutBlocks = html.replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  return withoutBlocks.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|</g, (match, tag?: string, attrs?: string) => {
    if (!tag) return '&lt;';
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    if (match.startsWith('</')) return VOID_TAGS.has(name) ? '' : `</${name}>`;
    if (name === 'a') {
      const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs ?? '');
      const url = (href?.[2] ?? href?.[3] ?? href?.[4] ?? '').trim();
      const safe = /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(url) ? url : '';
      const external = /^https?:\/\//i.test(safe);
      return safe ? `<a href="${escapeAttr(safe)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>` : '<a>';
    }
    return `<${name}>`;
  });
}
