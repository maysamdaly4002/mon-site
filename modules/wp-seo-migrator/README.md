# WP SEO Migrator (`hamdiayari.wp-seo-migrator`)

Assistant **1 clic** : collez l’adresse WordPress → analyse SEO automatique (pas de WXR à importer).

## Pour l’utilisateur

1. **Adresse du site** + **Analyser**
2. L’assistant lit : page d’accueil, REST WordPress, sitemaps, crawl des URLs, éventuellement FTP
3. Aperçu → **Migrer mon SEO**

### Options avancées (si besoin)

- Mot de passe d’application WordPress (REST plus riche)
- FTP / FTPS (`.htaccess`, exports sur disque)
- Mode expert : fichier d’export (dernier recours)

## Technique

Permissions : `net:outbound` (HTTP(S) anti-SSRF) + `net:ftp` (`ctx.ftp` côté hôte).

Voir [ARCHITECTURE.md](./ARCHITECTURE.md).
