/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
/**
 * Clés publiques NOVALABS acceptées pour la signature des modules et des licences
 * (identifiant de clé → clé SPKI Ed25519 en base64). Ajouter une clé lors d'une rotation,
 * retirer l'ancienne une fois tous les paquets re-signés.
 */
export const TRUSTED_KEYS: Readonly<Record<string, string>> = Object.freeze({
  'novalabs-2026': 'MCowBQYDK2VwAyEAJIWXFiaxzBQe042IMZUo/IGiKLGtTf7XBywgS6cpHWs=',
  /** Clé locale de développement (signature de nouveaux paquets sur cet environnement). */
  'novalabs-local-2026': 'MCowBQYDK2VwAyEAAp4iufU2icDH3Lh7+dm5aQIxm+/jH26ztpg27EZPOLo=',
});
