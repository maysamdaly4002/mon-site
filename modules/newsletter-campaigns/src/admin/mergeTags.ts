/**
 * Variables de fusion ({{prenom}}, {{person}}…).
 * Fichier sans dépendance : utilisable dans l'admin (aperçu) ET dans le serveur (envoi / test),
 * pour que l'aperçu et l'e-mail réel soient toujours identiques.
 */

/**
 * Passez à `true` quand le serveur utilise renderMergeTags() pour l'envoi et le test.
 * Active : les variables {{date}}, {{annee}}, {{site}} et la valeur de secours {{prenom|cher abonné}}.
 */
export const EXTENDED_TAGS = false;

export type TagDef = {
  key: string;
  label: string;
  /** Valeur d'exemple pour l'aperçu */
  sample: string;
  /** Autre nom accepté pour la même variable */
  aliasOf?: string;
  /** Nécessite le serveur à jour (EXTENDED_TAGS) */
  extended?: boolean;
};

export const MERGE_TAGS: TagDef[] = [
  { key: 'prenom', label: 'Prénom de l’abonné', sample: 'Mayssem' },
  { key: 'person', label: 'Alias de {{prenom}}', sample: 'Mayssem', aliasOf: 'prenom' },
  { key: 'email', label: 'Adresse e-mail', sample: 'mayssem@exemple.tn' },
  { key: 'desinscription', label: 'Lien de désinscription', sample: '#desinscription-exemple' },
  { key: 'date', label: 'Date d’envoi', sample: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), extended: true },
  { key: 'annee', label: 'Année en cours', sample: String(new Date().getFullYear()), extended: true },
  { key: 'site', label: 'Nom du site', sample: 'Mon site', extended: true },
];

export const activeTags = (): TagDef[] => MERGE_TAGS.filter((t) => !t.extended || EXTENDED_TAGS);

/** {{ cle }} ou {{ cle | valeur de secours }} */
const TAG_RE = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi;

/**
 * Remplace les variables. `values` contient les valeurs réelles (ou d'exemple) par clé.
 * Une valeur vide utilise la valeur de secours si elle est fournie : {{prenom|cher abonné}}.
 * Une variable inconnue est laissée telle quelle.
 */
export function renderMergeTags(html: string, values: Record<string, string>): string {
  return html.replace(TAG_RE, (match, rawKey: string, fallback?: string) => {
    if (fallback !== undefined && !EXTENDED_TAGS) return match;
    const def = activeTags().find((t) => t.key === rawKey.toLowerCase());
    if (!def) return match;
    const value = values[def.aliasOf ?? def.key] ?? values[def.key] ?? '';
    return value || (fallback ?? '').trim();
  });
}

/** Variables du texte qui ne seront pas remplacées (faute de frappe, variable non disponible…). */
export function findUnknownTags(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(TAG_RE)) {
    const [full, key, fallback] = m;
    const known = activeTags().some((t) => t.key === key.toLowerCase());
    if (!known || (fallback !== undefined && !EXTENDED_TAGS)) found.add(full.trim());
  }
  return [...found];
}

export const sampleValues = (): Record<string, string> =>
  Object.fromEntries(activeTags().map((t) => [t.key, t.sample]));
