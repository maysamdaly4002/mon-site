/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import { publicTheme } from './manager';

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Feuille de style et script du thème actif annoncés dès le HTML : pas de flash sans style.
 * Le descripteur est aussi inclus, car le HTML n'est jamais mis en cache alors que
 * /api/public/site-config peut l'être quelques secondes après un changement de thème.
 */
export async function injectTheme(html: string): Promise<string> {
  try {
    const theme = await publicTheme();
    if (!theme) return html;
    const json = JSON.stringify(theme).replace(/</g, '\\u003c');
    const tags = [
      theme.style ? `<link rel="stylesheet" href="${attr(theme.style)}" data-snapify-theme="${attr(theme.id)}" />` : '',
      `<link rel="modulepreload" href="${attr(theme.script)}" />`,
      `<script type="application/json" id="snapify-theme">${json}</script>`,
    ]
      .filter(Boolean)
      .join('\n    ');
    return html.replace('</head>', `    ${tags}\n  </head>`);
  } catch {
    return html;
  }
}
