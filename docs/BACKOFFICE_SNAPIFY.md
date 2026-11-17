# Backoffice Snapify — guide complet

## Accès

| Élément | URL / chemin |
|---------|----------------|
| Backoffice | `/administrator` |
| API admin | `/api/admin/*` (JWT) |
| API publique | `/api/public/*` |
| Sitemap | `/sitemap.xml` |
| Robots | `/robots.txt` |
| Base de données | PostgreSQL 17 (`snapify-postgres`, `127.0.0.1:5433`) |
| Sauvegardes | `backups/db/*.dump` (quotidien 03:30, 14 jours) |
| Médias | `public/uploads/` |

Identifiants : `ADMIN_EMAIL` / `ADMIN_PASSWORD` (`.env`).

## Fonctionnalités livrées (v2 — refonte complète, aucun JSON exposé)

- **Interface** : sidebar par rôle, palette de commandes `Ctrl+K`, bandeau maintenance, garde « modifications non enregistrées », toasts, mobile.
- **Tableau de bord / Statistiques** : visiteurs, sessions, durée moyenne, rebond, pays (drapeaux), sources, appareils, pages (temps moyen), export CSV, périodes 7/30/90/365 j.
- **Pages — constructeur visuel plein écran** : structure de la page à gauche (glisser-déposer, insertion entre deux blocs, duplication, masquage, suppression), inspecteur « Contenu » (tous les textes, boutons, images, vidéos, listes, icônes, tableaux) et « Style & animation » (fond blanc/gris/dégradé/sombre/marque/photo/vidéo + voile, motif décoratif, marges, largeur, animation d’apparition, ancre, masquage mobile/ordinateur), et **aperçu réel** du site à droite (ordinateur / tablette / mobile) mis à jour à chaque frappe. Cliquer un bloc dans l’aperçu l’ouvre dans l’inspecteur. Onglet « Page » : titre, statut, planification, adresse, modèle, fiche réalisation ; bouton « SEO » ; historique des versions.
- **25 blocs** (bibliothèque par catégorie avec recherche) : bannière d’accueil, en-tête de page, texte, texte + image / vidéo, sections + encadré, image, vidéo, diaporama, galerie, bandeau défilant, cartes (5 styles), vitrine à onglets, étapes, chiffres clés, panneaux extensibles, cartes de garanties, FAQ, témoignages, tableau, appel à l’action, réalisations (liste automatique), simulateur CEE, formulaire de contact, espace, code HTML.
- **Toutes les pages du site** (23, accueil comprise) sont composées de blocs stockés en base : aucun contenu de page n’est figé dans le code. Variables utilisables dans les textes : `{{telephone}}`, `{{email}}`, `{{delai}}`, `{{societe}}`, `{{annee}}`, `{{ans2030}}`.
- **Articles** : même inspecteur de blocs, planification, révisions.
- **SEO (type Yoast/Rank Math)** : analyse en direct (score SEO + lisibilité), aperçu Google desktop/mobile au pixel, Open Graph/Twitter, robots/canonical ; réglages globaux, redirections 301/302, sitemap & robots.txt ; Google Search Console (connexion, propriété, requêtes, pages).
- **Menus** : principal, mobile, pied de page — glisser-déposer, sous-menus, bouton mis en avant, aperçu desktop/mobile ; le site public lit ces menus.
- **Formulaires** : boîte de réception (lu/non lu, archive, CSV, réponse e-mail) + constructeur de champs visuel.
- **Boutons flottants** : barre mobile (par défaut « Appeler » / « Parler de votre projet »).
- **Apparence** : thèmes installés et marketplace de thèmes (import `.snaptheme`, aperçu avant activation), personnalisation des options du thème actif avec aperçu en direct, identité visuelle. La landing d’origine est le thème **SidiBou** — voir [MODULES.md](MODULES.md#10-thèmes).
- **Modules** : marketplace (catalogue local ou distant, import `.snapmod`), modules installés avec réglages générés, licence et contrôle d’intégrité. WhatsApp et Chat IA (modèle, température, quotas, prompt système, usage du jour) sont livrés comme modules — voir [MODULES.md](MODULES.md).
- **Newsletter** : abonnés, double opt-in, export CSV.
- **Identité visuelle** : logos (en-tête, pied de page), favicon, 8 couleurs du thème, polices — avec aperçu réel du site (choix de la page et de l’écran) avant enregistrement.
- **Infos générales, maintenance** (IP autorisées + lien de prévisualisation secret).

## Paramètres avancés (`/administrator/settings`)

Réservés à la permission « Modifier les paramètres avancés ». Chaque onglet signale les modifications non enregistrées ; les valeurs hors bornes sont refusées avant l’envoi (et revérifiées côté serveur).

| Onglet | Réglages |
|--------|----------|
| Général | URL publique, statistiques et bandeau cookies, état des services connectés (SMTP, Google, Gemini, clé de chiffrement) |
| E-mails | Serveur SMTP (préréglages Gmail, Microsoft 365, OVH, Brevo, Mailgun, SendGrid, Amazon SES ; chiffrement, délai, certificat auto-signé), expéditeur et adresse de réponse, envoi de test, alertes de sécurité et de comptes, journal des e-mails envoyés |
| Sécurité | Politique de mot de passe (longueur, majuscule, chiffre, symbole, expiration), durée de session, « rester connecté », déconnexion après inactivité, verrouillage après échecs de connexion, double authentification (facultative / super administrateurs / tous), liste d’IP autorisées pour l’administration, HSTS |
| Limites | Requêtes par minute (site public, administration), quotas des formulaires, de la newsletter et du mot de passe oublié |
| Médias | Taille maximale, types autorisés (images, SVG, vidéos, PDF) |
| Données | Durées de conservation (statistiques, messages, journal d’activité, journal des e-mails), stockage de l’IP des expéditeurs, purge immédiate |
| Système | Version, environnement, base de données, volume de contenu, durée du cache public |

Le mot de passe SMTP et les secrets 2FA sont chiffrés en base avec `SNAPIFY_SECRET_KEY` (à défaut `ADMIN_JWT_SECRET`). Le SMTP configuré ici a priorité sur les variables `SMTP_*` du `.env`.

Garde-fous : impossible d’enregistrer une liste d’IP qui exclut votre propre adresse, ni d’imposer la 2FA à un groupe dont vous faites partie sans l’avoir activée vous-même. En cas de blocage par la liste d’IP, démarrer avec `SNAPIFY_ADMIN_IP_BYPASS=true`.

## Utilisateurs, rôles et profil

**Utilisateurs** (`/administrator/users`)
- Invitation par e-mail (lien valable 7 jours, renvoyable) ou création avec mot de passe (générateur conforme à la politique, changement imposé à la première connexion). Sans SMTP, le lien est affiché pour être copié.
- Par compte : modifier nom, fonction, téléphone, e-mail et rôle ; lien de réinitialisation ; définir un mot de passe ; réinitialiser la 2FA ; fermer les sessions ; suspendre / réactiver ; supprimer (ou annuler l’invitation). Fiche détaillée avec sessions ouvertes et activité.
- Filtres par rôle et statut (dont « actifs sans 2FA »), recherche.

**Rôles** — rôles fournis : Super administrateur, Éditeur, Contributeur, Référenceur SEO, Lecteur. Le super administrateur peut créer, dupliquer, modifier, réinitialiser et supprimer des rôles (les comptes concernés sont réaffectés) ; 25 permissions réparties en 7 groupes, avec matrice récapitulative. Règles :
- on ne peut gérer ou attribuer qu’un rôle dont les permissions sont incluses dans les siennes ;
- le dernier super administrateur actif ne peut être ni rétrogradé, ni suspendu, ni supprimé ;
- sans droit de publication, une page ou un article déjà en ligne passe en lecture seule (le référencement reste modifiable avec le droit SEO).

**Journal d’activité** — toutes les actions sensibles (connexions, échecs, comptes, rôles, contenus, paramètres), filtres par catégorie, utilisateur et dates, export CSV.

**Mon profil** (`/administrator/profile`) — informations personnelles (le changement d’e-mail demande le mot de passe), mot de passe, double authentification TOTP avec codes de secours, sessions ouvertes (fermer une session ou toutes les autres), activité personnelle et liste de ses droits.

**Connexion** — mot de passe oublié, 2FA (application ou code de secours), verrouillage temporaire après trop d’échecs, écrans imposés (changement de mot de passe, activation de la 2FA) lorsque la politique l’exige.

## Base de données (PostgreSQL)

- Conteneur dédié : `docker-compose.db.yml` (`npm run db:up`), volume persistant `snapify_pgdata`, accessible uniquement en local.
- ORM : Drizzle — schéma `server/db/schema.ts`, migrations SQL versionnées dans `drizzle/`, appliquées automatiquement au démarrage.
- Tables : `pages`, `posts`, `revisions` (50 max par contenu), `menus`, `redirects`, `forms`, `form_submissions`, `newsletter_subscribers`, `media`, `admin_users`, `analytics_events` (rétention 400 jours, purge quotidienne), `site_settings` (réglages par section), `modules` et `module_storage` (modules et thèmes installés — colonne `kind` — et leurs données).
- Statistiques calculées en SQL (agrégats indexés), sans chargement des événements en mémoire.
- Modifier le schéma : éditer `server/db/schema.ts` → `npm run db:generate` → redémarrer.
- Sauvegarde manuelle : `npm run db:backup` · Restauration : `npm run db:restore -- backups/db/<fichier>.dump`.
- Ne pas modifier les tables CMS directement en SQL pendant que le serveur tourne (le serveur garde l'état en cache) : passer par le backoffice, ou redémarrer après.
- L'ancien `data/cms/snapshot.json` a été importé puis renommé `snapshot.json.imported-*` (copie de sécurité aussi dans `backups/`).

## Configuration production

```env
DATABASE_URL=postgres://snapify:***@127.0.0.1:5433/snapify
SNAPIFY_DB_PASSWORD=

GEMINI_API_KEY=
ADMIN_JWT_SECRET=
ADMIN_PASSWORD=
SNAPIFY_SECRET_KEY=          # chiffrement des secrets en base — ne plus changer une fois défini
SNAPIFY_ADMIN_URL=https://votre-domaine.fr/administrator   # liens des e-mails d’invitation
SNAPIFY_ADMIN_IP_BYPASS=false

# Facultatif : les identifiants Google se saisissent aussi dans SEO › Google Search Console
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://votre-domaine.fr/api/admin/google/callback   # utilisé seulement avec les identifiants du .env

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=contact@snapify.fr
```

## Connexion Google Search Console

Firebase n’est pas nécessaire : tout se fait dans Google Cloud Console (gratuit, environ 5 minutes). L’assistant **SEO › Google Search Console** guide pas à pas :

1. Créer un projet Google Cloud.
2. Activer l’API « Google Search Console API ».
3. Configurer l’écran de consentement (type « Externe »), puis le **publier** : en mode « Test », Google expire la connexion au bout de 7 jours.
4. Créer un client OAuth « Application Web » avec l’origine JavaScript et l’URI de redirection affichées par l’assistant (`https://votre-domaine.fr/api/admin/google/callback` ; en local `http://localhost:3010/api/admin/google/callback`).
5. Coller l’ID client et le code secret (ou importer le fichier JSON téléchargé) : Snapify les vérifie auprès de Google et chiffre le secret en base.

Il reste ensuite à cliquer sur « Se connecter avec Google » avec un compte ayant accès à la propriété dans Search Console. Les erreurs de retour (`redirect_uri_mismatch`, accès refusé, API désactivée…) sont expliquées dans l’admin, avec une section « Problèmes fréquents ». Les identifiants saisis dans l’admin sont prioritaires sur ceux du `.env`.

## Ajouter une réalisation

1. **Pages** → nouvelle page `/realisations/<nom>/`
2. Onglet **Page** → Modèle « Réalisation » → remplir la fiche (client, secteur, image, résultats)
3. Composer les blocs, publier : elle apparaît automatiquement dans les blocs « Réalisations » (accueil, secteurs, liste).

## Code

- Modèle des blocs : `server/cms/blocks.ts` · catalogue (libellés, valeurs par défaut) : `server/cms/blockCatalog.ts`
- Rendu public : `src/components/cms/` · formulaires de l’inspecteur : `src/admin/editor/blockSchemas.ts`
- Ajouter un type de bloc : type dans `blocks.ts` → entrée du catalogue → composant de rendu (`BlockRenderer.tsx`) → schéma de champs (`blockSchemas.ts`).
