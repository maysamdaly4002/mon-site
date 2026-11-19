# Module « Prévention incendie » pour ERP — Snapify

Suivi de conformité des **établissements recevant du public** : établissements (bâtiments, niveaux), inventaire d'équipements à **QR code**, contrôles planifiés avec **alertes e-mail**, saisie mobile (photo, hors-ligne), **non-conformités** avec plan d'action, **registre de sécurité infalsifiable** exportable en PDF. Bonus : exercices/formations, tableau de bord, rôles, intégration Snapify, **visites de la commission de sécurité** (prescriptions suivies jusqu'à la levée), **plans d'étage** avec positionnement des équipements, interface **française / arabe** (RTL).

## Installation (5 commandes)

```bash
docker compose up -d                                   # PostgreSQL 16
cp .env.example .env && npm install
export DATABASE_URL=postgresql://erp:erp@localhost:5432/erp   # PowerShell : $env:DATABASE_URL="..."
npm run db:migrate && npm run db:seed                  # schéma + 2 établissements, 34 équipements, 4 comptes
npm test                                               # 29 tests (23 sans base de données)
```

API autonome : `ERP_JWT_SECRET=<32+ caractères> npm start` → `http://localhost:3000/api` (documentation : `docs/openapi.yaml`, collection `docs/postman_collection.json`).
Comptes de démonstration (mot de passe `Demo1234!`) : `admin@` · `exploitant@` · `technicien@` · `auditeur@` `demo.tn`.

## Architecture

```
core/                 logique métier pure — aucun import Snapify ni SQL
  services.ts         règles : périodicités, échéances, contrôles, non-conformités, registre, alertes, tableau de bord
  registre.ts         chaîne de hachage du registre · pdf.ts : export PDF sans dépendance
  permissions.ts      rôles × périmètre par établissement · auth.ts : scrypt + jetons HS256
  schemas.ts          validation zod + nettoyage XSS · repository.ts : interface de stockage (sans delete)
adapters/
  postgres/           001_init.sql (schéma + triggers) · 002_commission_plans.sql (bonus) · dépôt SQL paramétré · migrate · seed
  snapify/            dépôt sur ctx.db.collection() (JSON)
src/
  routes.ts           table de routes unique · server.ts (Snapify) · standalone.ts (API REST + JWT) · admin/ (React)
tests/ · seed/ · docs/
```

**Pourquoi cette stack ?** TypeScript + zod (une seule langue front/back, validation typée), PostgreSQL (contraintes, transactions, triggers — nécessaires à un registre traçable), `node:http` et `node:crypto` (zéro framework pour la partie sécurité : on voit tout ce qui s'exécute). Même découpage que le module CRM : le cœur ne connaît que `ErpRepository` ; Snapify n'est qu'un adaptateur, ce qui rend l'intégration dans un CMS qu'on ne maîtrise pas peu risquée.

## Choix de conception

- **Règles réglementaires paramétrables.** Aucune périodicité dans le code : tables `types_equipement` (valeur par défaut) et `regles_periodicite` (type × catégorie, `NULL` = toutes). Priorité : règle de la catégorie > règle générale > défaut du type. Modifier une règle, ou la catégorie d'un établissement, **recalcule les échéances** concernées. Les valeurs du jeu de démonstration sont indicatives, **à valider avec la réglementation applicable**.
- **Échéance** = dernier contrôle (sinon mise en service) + périodicité, calculée à la saisie et stockée (indexée) ; un contrôle antidaté ne fait jamais reculer la date du dernier contrôle ; fin de mois ramenée au dernier jour (31 janv. + 1 mois = 28 févr.).
- **Contrôle = transaction unique** : contrôle + photo + entrée de registre + mise à jour d'échéance + non-conformité (si négatif). Tout ou rien (testé sur PostgreSQL).
- **Exercices et formations** partagent une table (`exercices.type`) : même logique de recyclage ; écart assumé avec le modèle minimal qui liste deux tables.
- **Commission de sécurité** : une visite (date, avis favorable/défavorable, prochaine visite) porte des **prescriptions** (responsable, échéance, statut à faire → en cours → levée). Visite et chaque changement de prescription sont inscrits au registre (types `visite` et `prescription`) ; une prescription levée ne se rouvre pas. Les prescriptions en retard et la prochaine visite (à venir ou dépassée) alimentent les **alertes e-mail** et le tableau de bord.
- **Plans d'étage** : une image (PNG/JPEG/WebP, signature vérifiée, 1,5 Mo) par niveau, stockée comme les photos ; les équipements y sont placés en **pourcentages** (indépendants de la résolution) en touchant le plan. Remplacer le plan garde les positions ; retirer un équipement met x/y à `NULL` (rien n'est supprimé).
- **Arabe** : le français est la langue des textes dans le code ; `src/admin/i18n.ts` contient le dictionnaire arabe, le bouton « العربية » (mémorisé dans le navigateur) bascule l'interface en lecture de droite à gauche. Un texte sans traduction reste en français.
- **Tableau de bord** : équipement conforme = en service ∧ échéance non dépassée ∧ aucune non-conformité ouverte.

## Registre de sécurité : comment garantir qu'il n'est pas falsifiable ?

Trois couches indépendantes :
1. **Pas d'API de modification** : le dépôt n'expose que `append`, `list`, `get` — ni update ni delete, nulle part (aucune suppression dans tout le module). Corriger = ajouter une entrée `correction` liée à l'originale (auteur et date conservés, l'originale reste visible).
2. **PostgreSQL** : triggers qui refusent `UPDATE` et `DELETE`, `UNIQUE (etablissement_id, seq)` contre les fourches, verrou consultatif par établissement ; en production, rôle applicatif limité à `SELECT, INSERT` (voir fin de `001_init.sql`).
3. **Chaîne de hachage SHA-256** : chaque entrée contient le hash de la précédente (JSON canonique, horodatage serveur). Un administrateur de base qui désactiverait le trigger et modifierait une ligne **casse la chaîne**, détectée à chaque affichage, à chaque export PDF (en-tête d'intégrité) et par `GET /registre/verify`. Testé : modification, suppression, horodatage changé. Les photos sont liées par leur empreinte SHA-256 dans l'entrée.
   *Limite honnête* : un attaquant qui réécrit **toute** la chaîne depuis le début la rend cohérente. Remède prévu : ancrer périodiquement le dernier hash hors de la base (e-mail daté à l'exploitant, horodatage qualifié).

## Alertes : comment ne manquer aucune échéance ?

`POST /api/alertes/run` (cron quotidien ; l'API autonome le fait aussi toutes les heures) balaye **l'état stocké** (donc rien n'est perdu si le serveur était arrêté), envoie un résumé par établissement (à venir dans 30 j, en retard, actions correctives en retard) et enregistre une clé unique `équipement|échéance|type[|semaine]` **après** l'envoi réussi : panne SMTP → pas de clé → réessai au passage suivant ; double exécution → aucun doublon ; retards rappelés chaque semaine jusqu'au contrôle. Testé (panne simulée, idempotence, rappel hebdomadaire).

## Terrain sans réseau (sous-sol)

La page « Saisie d'un contrôle » est pensée pour smartphone (gros boutons, photo en un geste, redimensionnée à 1280 px avant envoi). Sans réseau, le contrôle est **conservé sur l'appareil** (file d'attente `localStorage`) et envoyé automatiquement au retour de la connexion (bouton « Synchroniser » en secours). Le serveur contrôle la date et les droits à la réception, pas à la saisie. Évolutions prévues : Service Worker + IndexedDB (cache de l'inventaire pour scanner hors-ligne) et clé d'idempotence par contrôle.

## Sécurité

Validation zod de toutes les entrées ; balises HTML et caractères de contrôle retirés (XSS stocké), React échappe à l'affichage, le PDF n'interprète rien · SQL **100 % paramétré**, noms de colonnes en liste blanche, identifiants non-UUID = « introuvable » (testé avec `'; DROP TABLE…`) · photos : type annoncé **et** signature binaire vérifiés, 1,5 Mo max · mots de passe scrypt + sel, jetons HS256 à durée limitée, comparaisons à temps constant, même message pour e-mail inconnu / mot de passe faux, 8 tentatives/minute · en-têtes `nosniff`, CSP stricte, `no-store`.
**Contrôle d'accès** : un seul point (`authorize`) vérifie le **rôle** (admin, exploitant, technicien externe, auditeur en lecture seule) **et** le **périmètre** (table `acces`) ; les listes sont filtrées, les accès directs refusés (403).

## Intégration dans Snapify (même procédure que le module CRM)

1. Copier le dossier dans `mon-site/modules/erp-incendie/` (sans `node_modules`) ; `npm install zod qrcode` à la racine du site.
2. Vérifier `src/server.ts` contre `sdk/index.ts` (3 points isolés : forme des handlers, utilisateur connecté, API e-mail).
3. `npm run module -- build modules/erp-incendie --unsigned`, installer le paquet depuis l'administration ; le menu affiche les 9 pages.
4. Planifier `POST …/alertes/run` chaque matin.

## Tests

`npm test` : 23 tests du cœur (mémoire) dont 9 pour la commission et les plans (journalisation, levée, droits, alertes, plans, coordonnées, faux fichiers) — échéance, règle par catégorie + recalcul, contrôle/antidatage, non-conformité automatique, levée, chaînage et falsification du registre, immuabilité + correction, droits d'accès, alertes, validation/XSS/QR, PDF, tableau de bord, authentification, jeu de démonstration.
`TEST_DATABASE_URL=… npx tsx --test --test-concurrency=1 tests/*.test.ts` : + 6 tests PostgreSQL (triggers, contournement détecté, 20 écritures concurrentes sans fourche, rollback, injection SQL, contraintes des nouvelles tables). `TEST_BACKEND=snapify npm test` : mêmes tests sur l'adaptateur Snapify simulé.

## Limites connues

- **Couche Snapify non exécutée** : `src/server.ts` et `src/admin/index.tsx` suivent les contrats observés dans le module CRM ; props de certains composants (`Button disabled`, `Input type/max`, `Td className`) et forme des handlers à vérifier. `npm run typecheck` utilise des déclarations minimales (`src/sdk.d.ts`), pas le vrai SDK. L'interface a été rendue dans jsdom (9 pages, français et arabe) avec des composants simulés, pas dans un vrai navigateur ni avec les vrais composants Snapify.
- Collections Snapify : ni transaction ni UNIQUE → écritures sérialisées par `ctx.lock`, contrôle + registre **non atomiques** (PostgreSQL l'est).
- Photos stockées en base (base64, 1,5 Mo max) ; un stockage objet est préférable en production.
- Pas de rafraîchissement de jeton, pas de réinitialisation de mot de passe, e-mail par défaut simulé (interface `Mailer` : brancher SMTP/Brevo, comme pour le module newsletter).
- Hors-ligne : pas d'idempotence (une réponse perdue puis un renvoi peut dupliquer un contrôle — visible au registre, corrigeable) ; pas de cache d'inventaire.
- Arabe : traduction des textes de l'interface (pas des messages d'erreur du serveur ni des libellés du menu Snapify, fixés par le manifeste) ; à faire relire par un locuteur natif. Dates et nombres gardent le format du CMS.
- Plans : image seulement (pas de PDF ni de DWG) ; une seule version par niveau (l'ancien fichier reste stocké mais n'est pas consultable dans l'interface).
- QR code = code seul (`EQ-…`), pas de lien profond.
- Mise à jour d'une base existante : `npm run db:migrate` applique `002_commission_plans.sql` (les entrées du registre déjà écrites ne sont pas touchées). Sur Snapify (collections), rien à migrer.
