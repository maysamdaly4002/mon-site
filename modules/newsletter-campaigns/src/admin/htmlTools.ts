/** Outils HTML pour l'éditeur de campagne : nettoyage, import de fichier. */

const DANGEROUS = 'script,iframe,object,embed,link,base,noscript,meta,form,frame,frameset';

/** Retire les scripts, les gestionnaires d'événements (onclick…) et les liens javascript:. */
function clean(doc: Document) {
  doc.querySelectorAll(DANGEROUS).forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const isUrl = name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action';
      if (name.startsWith('on') || (isUrl && /^\s*(javascript|vbscript):/i.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
  });
}

/** Garde le contenu du <body> et les blocs <style> du <head>, sans rien d'exécutable. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  clean(doc);
  const styles = Array.from(doc.head.querySelectorAll('style')).map((s) => s.outerHTML).join('\n');
  return (styles ? styles + '\n' : '') + doc.body.innerHTML;
}

/** Lit un fichier .html complet : contenu nettoyé, titre (<title>) et nombre d'images à chemin local. */
export function parseImportedHtml(text: string) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const title = (doc.title || '').trim();
  const localImages = Array.from(doc.querySelectorAll('img')).filter(
    (i) => !/^(https?:|data:|cid:|\/\/)/i.test((i.getAttribute('src') || '').trim()),
  ).length;
  return { html: sanitizeHtml(text).trim(), title, localImages };
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
