# Module LMS — Learning Management System pour Snapify

Cours (chapitres, leçons texte / vidéo / lien **avec plusieurs médias par leçon** : vidéos, images, documents, liens), inscriptions, suivi de progression, quiz notés **par le serveur** et **certificats PDF vérifiables**.
Même architecture que les modules CRM et ERP : un cœur métier sans dépendance au CMS, trois dépôts de données interchangeables (mémoire, PostgreSQL, collections Snapify) et une table de routes unique.

## Installation (5 commandes)

```bash
docker compose up -d                       # PostgreSQL (ou une base Neon : DATABASE_URL=…?sslmode=require)
npm install
export DATABASE_URL=postgresql://lms:lms@localhost:5432/lms   # PowerShell : $env:DATABASE_URL="…"  ·  cmd : set DATABASE_URL=…
npm run db:migrate && npm run db:seed
export LMS_JWT_SECRET=une-longue-valeur-aleatoire-de-32-caracteres-ou-plus && npm start   # API sur http://localhost:3000/api
```

`npm run check` (contrôle des types + tests). `npm test` fonctionne sans base de données ; avec `TEST_DATABASE_URL`, les tests propres à PostgreSQL s'exécutent aussi.
Comptes de démonstration (mot de passe `Demo1234!`) : `admin@demo.tn`, `instructeur@demo.tn`, `apprenant@demo.tn`, `sami@demo.tn`, `auditeur@demo.tn`.
Documentation de l'API : `docs/openapi.yaml` et `docs/postman_collection.json` (lancer d'abord « Connexion »).

## Intégration dans Snapify

```bat
:: depuis le dossier du site (le module ne doit contenir ni node_modules ni .git)
npm install zod
npm run module -- build modules/lms --unsigned
npm run dev
```
Puis installer le paquet généré depuis l'administration Snapify : le menu affiche 5 pages — *Formation — Tableau de bord*, *Cours*, *Mon apprentissage*, *Inscriptions et suivi*, *Certificats* — et le site public gagne les pages `/formation/*` (ci-dessous).
Dans l'administration, l'administrateur connecté (`req.admin`) peut aussi suivre des cours : son identifiant de session devient celui de l'apprenant. Les apprenants **sans compte** sont inscrits par e-mail par un formateur, qui enregistre leur progression (formation présentielle).

## Interface d'administration

Même présentation que le module CRM : en-tête de page avec actions, **barre de recherche + filtres** au-dessus de chaque tableau, tableaux du SDK (lignes cliquables, badges, **pagination**), cartes de statistiques et états vides.
- **Cours** : recherche (titre, description, formateur), filtres statut / niveau, export du suivi. L'éditeur de leçon permet d'ajouter, réordonner (Monter / Descendre) et retirer des médias (voir « Médias multiples par leçon »).
- **Inscriptions et suivi** : choix du cours, recherche (nom, e-mail), filtre d'état, clic sur une ligne = progression détaillée (« Marquer fait »).
- **Certificats** : recherche (apprenant, cours, code), vérification d'un code, export.
- **Import CSV / Excel** (page *Inscriptions et suivi*) : colonnes `Nom`, `Prénom` (facultative), `E-mail` ; `.csv` (séparateur `,` ou `;`) ou `.xlsx` (1re feuille). 1 000 lignes maximum, cours publié obligatoire. Mêmes règles que l'inscription manuelle ; les doublons (déjà inscrit ou répété dans le fichier) et les lignes invalides sont listés dans un rapport, jamais réinscrits. Via l'API : `POST /inscriptions/import` avec `dryRun: true` pour valider sans écrire.
- **Export CSV** : suivi (par cours ou tous les cours) et certificats ; les cellules commençant par `=`, `+`, `-`, `@` sont neutralisées (injection de formules Excel).
- La lecture des `.xlsx` utilise `read-excel-file` (déjà présent dans le module CRM) : lancez `npm install` pour mettre à jour `package-lock.json`.

## Certificat PDF

Format A4 paysage, généré sans dépendance (`core/pdf.ts`) : titre, nom de l'apprenant et du cours (ajustés et tronqués proprement s'ils sont très longs), date en français, sceau, **code de vérification**, **empreinte SHA-256** complète et, si l'adresse du site est connue, un **lien de vérification cliquable** (`…/formation/verifier/?code=CERT-…`) et un **QR code** qui ouvre la même page (≈ 2,5 cm, noir sur blanc, légende « Scannez pour vérifier »). Le QR code est généré sans dépendance (`core/qr.ts`, norme ISO 18004, correction d'erreurs M) ; il n'est dessiné que si l'adresse commence par `https://` et tient dans un QR code (213 octets), sinon le certificat reste valable, sans QR. Le QR code est vérifié en lisant le PDF rendu avec un vrai décodeur.
Réglages (Administration → Modules → Formation → *Certificat*) : nom de l'organisme, nom du signataire, adresse du site (`https://…`). En API autonome : variables `LMS_ORGANISATION`, `LMS_SIGNATORY`, `LMS_VERIFY_URL`. Les réglages sont relus à chaque téléchargement ; les certificats déjà délivrés prennent donc le nouvel habillage sans être modifiés en base (le hash ne couvre pas l'habillage).
Un lien n'est imprimé que si l'adresse commence par `https://`.

## Pages publiques pour les apprenants (`/formation/*`)

| Adresse | Contenu |
|---|---|
| `/formation/` | catalogue des cours publiés + « Mes formations » avec barres de progression |
| `/formation/cours/<id>/` | programme visible par tous ; pour un inscrit : leçons (texte, vidéo YouTube/Vimeo intégrée, lien, puis tous les médias de la leçon : vidéos, images, documents, liens), « marquer comme terminée », quiz, certificat PDF |
| `/formation/certificats/` | mes certificats (téléchargement PDF) |
| `/formation/verifier/?code=CERT-…` | vérification publique d'un certificat (nom, cours, date — jamais l'e-mail) |

- **Comptes** : le module s'appuie sur l'« Espace client » (`novalabs.customers`, déclaré en `uses`) — inscription et connexion sur `/compte/`. L'apprenant est le client connecté, reconnu par `customers.current(cookies)`. Sans ce module, le catalogue reste consultable et le site indique que les comptes ne sont pas activés.
- **Réglages** (Administration → Modules → Formation) : titre et introduction du catalogue, *inscription libre des visiteurs connectés* (désactivée : seuls les formateurs inscrivent) et *relier les inscriptions faites par un formateur au compte du même e-mail* (désactivé par défaut : l'e-mail d'un compte client n'est pas forcément vérifié).
- **Sécurité** (`src/public-api.ts`) : un visiteur n'a que le rôle `apprenant` et passe par les mêmes méthodes du cœur que les autres apprenants ; aucune route publique ne crée ni ne modifie un cours ; seuls les champs attendus sont lus (inscrire quelqu'un d'autre ou se donner un rôle via le corps de la requête est ignoré) ; contenu des leçons réservé aux inscrits ; bonnes réponses jamais envoyées ; vérification des certificats limitée à 20 essais par minute et par adresse ; vidéos YouTube/Vimeo seules intégrées (cadre `sandbox`), toute autre adresse s'ouvre dans un nouvel onglet ; texte des leçons affiché sans HTML. Les cookies de session restent ceux de l'Espace client (`HttpOnly`, `SameSite=Lax`).
- **Routes publiques** (sous `/api/modules/local.lms/`) : `GET public/me`, `GET public/cours`, `GET public/cours/detail?id=`, `POST public/inscription`, `POST public/lecon/terminer`, `POST public/quiz/soumettre`, `GET public/certificats`, `GET public/certificat/pdf?id=`, `GET public/certificat/verifier?code=`.

## Médias multiples par leçon

Une leçon a un **contenu principal** (texte, vidéo ou lien, comme avant) et une liste ordonnée de **médias complémentaires** (jusqu'à 20), affichés à la suite dans l'ordre choisi :

| Type | Affichage pour l'apprenant |
|---|---|
| `video` | YouTube / Vimeo : lecteur intégré (cadre `sandbox`, chargement différé) ; autre adresse : lien dans un nouvel onglet |
| `image` | image affichée (chargement différé, sans en-tête *referrer*), cliquable pour l'ouvrir en grand |
| `document` | lien « Ouvrir le document » dans un nouvel onglet (PDF, Word, PowerPoint, etc.) |
| `lien` | lien dans un nouvel onglet (le titre du média sert de texte du lien) |

- **Éditeur** (Cours → leçon → *Ajouter un média*) : type, titre facultatif, adresse `https://`, boutons *Monter / Descendre / Retirer*. Le **type est deviné d'après l'adresse** (YouTube/Vimeo → vidéo, `.jpg` / `.png`… → image, `.pdf` / `.docx`… → document, sinon lien) tant que le formateur ne l'a pas choisi lui-même. Les lignes laissées sans adresse sont ignorées à l'enregistrement.
- **Texte facultatif** : une leçon de type texte peut ne contenir que des médias (le texte n'est obligatoire que s'il n'y a aucun média).
- **API** : `POST /lecon/save` accepte `medias: [{ type, titre?, url }]`. À la modification, la liste fournie **remplace** l'ancienne ; omise, elle est conservée ; `[]` la vide (ce qui exige alors un texte ou une adresse principale). Voir `docs/openapi.yaml`.
- **Accès** : comme le texte des leçons, les médias ne sont envoyés qu'aux inscrits, aux gestionnaires du cours et aux auditeurs. Un visiteur voit seulement le **nombre** de médias de chaque leçon (`nbMedias`), jamais leurs adresses.
- **Sécurité** : chaque adresse doit commencer par `https://` (aucun `http:`, `javascript:`, `data:`…), vérifiée par zod **et** par la base (contrainte SQL `lessons_medias_valid`) ; titres débarrassés de tout HTML ; une seule leçon reste à terminer, quel que soit le nombre de médias.
- **Mise à jour depuis la 1.0.0** : lancez `npm run db:migrate` (migration `002_lesson_medias.sql` : colonne `medias`, `'[]'` pour les leçons existantes). Dans Snapify (collections JSON), rien à migrer : une leçon sans champ `medias` est lue comme n'en ayant aucun. Réinstallez ensuite le paquet du module (version 1.1.0).

## Séances en direct (Google Meet) et avis des apprenants

Chaque cours peut avoir, en plus des leçons, **trois champs facultatifs** (Cours → ouvrir un cours → carte d'informations) :

| Champ | Contenu | Qui le voit |
|---|---|---|
| `meetUrl` | salle Google Meet, `https://meet.google.com/abc-defg-hij` | inscrits et gestionnaires du cours, auditeurs |
| `meetHoraire` | jours et heure en texte libre (« Chaque mardi, 18 h (heure de Tunis) ») | tout le monde, y compris le catalogue |
| `feedbackUrl` | formulaire d'avis (Google Forms, etc.), adresse `https://` | inscrits et gestionnaires ; le bouton « Donner mon avis » apparaît une fois le cours **terminé** |

- **Page du cours** : un encadré « Séances en direct » avec l'horaire et le bouton « Rejoindre la séance (Google Meet) » (nouvel onglet, `noopener noreferrer`). Un visiteur non inscrit ne voit que l'horaire.
- **Sécurité** : seules les adresses `https://meet.google.com/…` sont acceptées pour la salle (zod **et** contrainte SQL `courses_meet_url_valid`) : `http:`, `javascript:`, `meet.google.com.autre-site.tn`, Zoom, etc. sont refusés. Le lien d'une salle et celui du formulaire ne sont jamais envoyés à un visiteur non inscrit (`liveFields` dans `core/services.ts`), comme le contenu des leçons.
- **API** : `POST /cours/save` accepte `meetUrl`, `meetHoraire`, `feedbackUrl` ; omis à la modification, ils sont conservés ; une chaîne vide les retire. Voir `docs/openapi.yaml`.
- **Mise à jour** : lancez `npm run db:migrate` (migration `003_course_live.sql` : trois colonnes `''` par défaut). Dans Snapify (collections JSON), rien à migrer : un cours sans ces champs est lu comme n'en ayant aucun. Réinstallez ensuite le paquet du module (version 1.2.0).
- **Conseils** : créez la salle dans Google Agenda (événement récurrent avec « Ajouter une visioconférence Google Meet ») pour qu'elle reste la même à chaque séance, et réglez-la sur « accès sur invitation / approbation de l'organisateur » pour éviter les intrusions. Le texte d'horaire doit toujours préciser le **fuseau horaire**.

## Améliorer un cours

Un plan en 5 étapes (avis → analyse → améliorations → test → répétition) et un **modèle de module** (Word) se trouvent dans `docs/` : `plan-amelioration-cours.md` et `modele-de-module.docx`. Le formulaire d'avis (`feedbackUrl`) et le tableau de bord (taux d'achèvement, score moyen, inactifs) fournissent les chiffres de départ.

## Confort de lecture (défilement)

- Choisir une leçon dans le programme amène directement au contenu de la leçon (utile sur mobile, où le programme est au-dessus) ; le focus suit pour le clavier et les lecteurs d'écran.
- « Marquer comme terminée » passe à la leçon suivante non terminée, ou amène au quiz s'il n'en reste plus. Boutons *leçon précédente / suivante* sous chaque leçon.
- Le programme est une liste défilante (hauteur limitée sur mobile, collante sur ordinateur) qui garde la leçon active visible ; le résultat du quiz est amené à l'écran, avec le bouton du certificat en cas de réussite.
- Changer de page (catalogue → cours…) repart en haut. Le défilement doux est désactivé si le système demande de réduire les animations.

## Fonctionnement

- **Cours** : brouillon → publié → archivé. Publier exige au moins une leçon ; un cours qui a des inscrits ne repasse pas en brouillon.
- **Leçons** : texte (retours à la ligne conservés), vidéo ou lien (adresse `https://` uniquement, vérifiée aussi par une contrainte SQL), plus jusqu'à **20 médias complémentaires** (voir ci-dessous). Seules les vidéos YouTube et Vimeo sont intégrées dans une page (cadre `sandbox`) ; toute autre adresse s'ouvre dans un nouvel onglet (`noopener noreferrer`).
- **Rien n'est supprimé** : retirer un chapitre, une leçon ou une question la marque `archive` ; la progression déjà enregistrée reste lisible et le pourcentage est recalculé sur les leçons actives.
- **Progression** : une ligne `progressions` par leçon terminée (append-only, unique par inscription et leçon). L'apprenant valide ses leçons, ou le formateur du cours le fait pour lui.
- **Quiz** : un quiz final par cours, questions à choix unique ou multiple. Disponible une fois toutes les leçons terminées ; seuil et nombre de tentatives paramétrables. Le **score est calculé côté serveur** (une question à réponses multiples n'est juste que si l'ensemble est exact) ; les bonnes réponses ne sont **jamais** envoyées à un apprenant, ni avant ni après la soumission.
- **Fin de cours et certificat** : cours terminé = toutes les leçons faites **et** (pas de quiz ou quiz réussi). Le certificat est alors délivré une seule fois, dans la même transaction. Il porte un code `CERT-XXXXXXXXXX` (alphabet sans caractères ambigus) et une empreinte SHA-256 de (code, cours, apprenant, titre, date). La vérification publique (`GET /certificat/verifier?code=…`) ne renvoie que le nom, le cours et la date ; une ligne modifiée directement en base est détectée (empreinte différente → « invalide », PDF refusé).
- **Tableau de bord** : inscrits, terminés, taux d'achèvement, score moyen (meilleure tentative de chaque inscrit), apprenants inactifs (aucune activité depuis 14 jours).

## Rôles et contrôle d'accès

| Rôle | Peut |
|---|---|
| `admin` | tout, y compris créer des comptes ; suit aussi des cours |
| `instructeur` | créer des cours et gérer **uniquement les siens** (contenu, quiz, inscriptions, progression, certificats de ses cours) |
| `apprenant` | voir les cours publiés, s'inscrire, suivre ses cours, passer les quiz, télécharger ses certificats ; ne voit que ses inscriptions |
| `auditeur` | lecture seule sur tout |

Un seul point de contrôle (`core/permissions.ts`) vérifie le rôle **et** le périmètre (le cours est-il à ce formateur ?). Un brouillon est « introuvable » pour qui n'a aucun droit dessus ; le contenu des leçons n'est donné qu'aux inscrits et aux gestionnaires.

## Mise en production

**API autonome** (Docker) :
```bash
export LMS_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
docker compose --profile api up -d --build      # base PostgreSQL + API sur :3000 ; migrations appliquées au démarrage
```
Pour une base gérée (Neon, RDS…) : construire l'image seule (`docker build -t lms .`) et lancer avec `DATABASE_URL=…?sslmode=require`.
- `GET /health` interroge la base (500 si elle ne répond pas) : à brancher sur la sonde de santé de l'hébergeur. `HEALTHCHECK` Docker inclus.
- Arrêt propre sur `SIGTERM` (requêtes en cours terminées, pool fermé, 10 s maximum) ; connexions PostgreSQL inactives perdues sans faire tomber le processus ; délais de requête, corps limité à 1 Mo, `statement_timeout` de 15 s.
- En-têtes de sécurité (HSTS, CSP, `nosniff`, `no-referrer`, pas de cache). **Placez l'API derrière un proxy TLS** (Nginx, Caddy, load balancer) : elle ne parle pas HTTPS elle-même.
- Ne lancez **pas** `npm run db:seed` en production : il crée des comptes de démonstration au mot de passe connu. Créez le premier administrateur autrement (voir ci-dessous), puis les autres comptes via `POST /api/users/add`.
- Le limiteur de connexions et celui de la vérification des certificats sont **en mémoire** : avec plusieurs instances, la limite s'applique par instance (ajoutez une limite au niveau du proxy si besoin).
- Sauvegardez la base (`pg_dump`) : les certificats, tentatives et progressions sont append-only mais ne sont pas répliqués ailleurs.

Premier administrateur, sans données de démonstration :
```bash
ADMIN_EMAIL=moi@exemple.tn ADMIN_NAME="Mon Nom" ADMIN_PASSWORD='un-mot-de-passe-long' npm run db:create-admin
```
Dans Docker : `docker compose --profile api run --rm -e ADMIN_EMAIL=… -e ADMIN_PASSWORD=… api npm run db:create-admin`.

**Module Snapify** : voir « Intégration dans Snapify » ci-dessus ; renseignez les réglages du module (organisme, signataire, adresse du site) avant de délivrer les premiers certificats.

## Choix techniques

- **TypeScript + zod** (validation de toutes les entrées ; HTML supprimé du texte saisi) ; **React** pour l'interface (composants du SDK Snapify), mobile d'abord.
- **PostgreSQL** comme base relationnelle livrée : migration `001_init.sql`, clés étrangères, `UNIQUE` (une inscription par cours, une progression par leçon, un numéro de tentative, un certificat par cours et apprenant), `CHECK`, et **triggers append-only** sur `progressions`, `tentatives` et `certificats`. Requêtes toujours paramétrées ; les noms de tables et de colonnes viennent d'une liste blanche.
- **Authentification** de l'API autonome : mots de passe `scrypt` salés, jetons HS256 à durée limitée, limitation des tentatives de connexion, message d'erreur identique pour e-mail inconnu et mauvais mot de passe.
- **Node natif** (`node:http`, `node:test`, `node:crypto`) : pas de framework, peu de dépendances (`pg`, `zod`).

## Limites connues

- Dans Snapify, les collections JSON n'ont ni transactions ni contrainte `UNIQUE` : toutes les écritures sont sérialisées par `ctx.lock`, mais la « fin de cours + certificat » n'est pas atomique comme sur PostgreSQL.
- Les pages publiques dépendent du module « Espace client » pour la connexion ; l'identité qu'il renvoie (`id`, `firstName`, `lastName`, `email`) est lue de façon défensive dans `src/server.ts` — c'est le point à vérifier sur votre site. Après connexion, l'Espace client ne ramène pas forcément à la formation : l'apprenant revient via le menu.
- Un apprenant sans compte ne peut pas passer le quiz lui-même : le formateur saisit ses réponses papier (route d'administration `/quiz/soumettre`, sans interface dédiée).
- Pas de paiement, forum, e-mails de rappel (ni rappels automatiques avant les séances Meet : le module affiche le lien, il ne crée pas la salle ni n'invite les apprenants), import SCORM, ni interface en arabe. Pas de dépôt de fichiers : les vidéos, images et documents sont des **liens** vers un hébergement externe (YouTube, Vimeo, un espace de stockage en ligne…). Une image s'affiche depuis son site d'origine : si celui-ci bloque l'affichage externe, le lien « Ouvrir l'image en grand » reste disponible. Un lien de partage qui n'est pas un accès direct (page d'aperçu d'un service de stockage, par exemple) s'ouvre dans un nouvel onglet mais ne s'affiche pas dans la page.
- Les leçons ajoutées après la fin d'un cours ne réouvrent pas les inscriptions déjà terminées (le certificat reste valable).
- Les interfaces (5 pages d'administration, 4 pages publiques) ont été rendues dans jsdom avec des composants et des API simulés (parcours complet, visiteur anonyme et connecté), pas dans un navigateur ni sur un vrai site Snapify.
