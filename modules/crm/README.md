# Module CRM pour Snapify

CRM léger : **contacts, entreprises, pipeline de ventes (kanban), historique (notes/appels/e-mails), capture de leads**, + bonus (import/export CSV avec détection de doublons, tableau de bord).

## Architecture

```
core/                 logique métier pure (aucun import Snapify ni base de données)
  schemas.ts          validation zod + nettoyage XSS
  services.ts         règles métier (doublons, kanban, leads, CSV, tableau de bord)
  repository.ts       interface de stockage — seule dépendance du cœur
  memory.ts           dépôt en mémoire (tests)
adapters/
  postgres/           schéma relationnel + migrations + dépôt SQL paramétré (livrable de l'épreuve)
  snapify/            dépôt sur ctx.db.collection() (JSON dans module_records)
src/                  couche Snapify : server.ts (routes) + admin/ (interface React)
tests/                13 tests, exécutés sur les 3 dépôts
seed/                 données de démonstration
snapify.module.json   manifeste du module
```

**Pourquoi deux adaptateurs ?** Les collections de Snapify sont des documents JSON (pas de clés étrangères ni de contrainte UNIQUE). L'épreuve exige une base relationnelle avec migrations : le cœur ne connaît que `CrmRepository`, et chaque environnement fournit le sien. C'est aussi la réponse à « comment intégrer ce module dans un CMS dont vous ne maîtrisez pas le code ? » : le CMS n'est qu'un adaptateur.

## Installation (démo relationnelle, 5 commandes)

```bash
docker compose up -d
cp .env.example .env && npm install
export DATABASE_URL=postgresql://crm:crm@localhost:5432/crm   # PowerShell : $env:DATABASE_URL="..."
npm run db:migrate && npm run db:seed
npm test
```

Tests sur PostgreSQL : `TEST_DATABASE_URL=… npx tsx --test --test-concurrency=1 tests/*.test.ts` ;
sur l'adaptateur Snapify (collections simulées) : `TEST_BACKEND=snapify npm test`.

## Installation dans le site Snapify (`mon-site`)

1. Copier ce dossier dans `mon-site/modules/crm/` (sans `node_modules`).
2. `npm install zod` à la racine de `mon-site` (le cœur utilise zod).
3. Vérifier `src/server.ts` contre `sdk/index.ts` (forme de l'argument des handlers — voir « Limites »).
4. Construire : `npm run module -- build modules/crm --unsigned`, puis installer le paquet depuis l'administration.
5. Le menu affiche : CRM — Tableau de bord, Contacts, Entreprises, Pipeline.

**Formulaire public** : `POST /api/modules/local.crm/leads` avec `{ email, name?, phone?, company?, message?, source? }`. Le champ `website` est un piège anti-robots (il doit rester vide).

## Sécurité

- Validation de toutes les entrées (zod) ; balises HTML et caractères de contrôle retirés (XSS stocké) ; l'interface React échappe à l'affichage.
- PostgreSQL : requêtes **paramétrées uniquement**, noms de colonnes en liste blanche, identifiants non-UUID traités comme « introuvable ».
- Export CSV : neutralisation de l'injection de formules (`=`, `+`, `-`, `@`).
- Routes d'administration derrière l'authentification de Snapify ; route publique limitée au dépôt d'un lead.

## Performance (100 000 contacts)

Index trigramme (`pg_trgm`) sur la recherche, pagination serveur (max. 100). Mesuré : recherche « contient » sur 100 000 contacts en **~1,6 ms** (PostgreSQL 16, plan = Bitmap Index Scan).

## Limites connues

- **Couche Snapify non exécutée** : `src/server.ts` et `src/admin/index.tsx` s'appuient sur les contrats vus dans les modules existants, mais l'argument exact des handlers (`req`) et les props de certains composants du SDK doivent être vérifiés dans `sdk/index.ts`. L'adaptateur Snapify est testé contre une simulation de `records.ts`, pas contre le CMS réel.
- Collections Snapify : pas de contrainte UNIQUE (unicité de l'e-mail garantie par `ctx.lock`), pas d'agrégation SQL (le tableau de bord parcourt les contacts par pages de 500) ; recherche sur champs séparés, plafond 100 000 enregistrements par collection.
- Pas encore : serveur REST autonome (auth JWT) + fichier OpenAPI, rôles lecture seule, tâches et rappels, widget de formulaire intégrable, limitation de débit (à brancher sur le module `recaptcha`), version arabe.
