# WP SEO Migrator — Plan d’architecture (étape 1)

**Module** : `hamdiayari.wp-seo-migrator`  
**Auteur marketplace** : Hamdi Ayari  
**API Snapify cible** : `^1.3.0`  
**Doc lue** : https://developers.snapify.fr/ (+ `docs/MODULES.md`, `@snapify/sdk`, modules de référence `ai-articles`, `calendar`, `ai-chat`)

---

## 1. Objectif produit

Assistant « migration SEO WordPress → Snapify » en 4 écrans, public non technique, dry-run, reprise, rapport, surveillance 30 j.

## 2. Points de la doc Snapify utilisés

| Besoin | Doc / API | Réf. |
| --- | --- | --- |
| Manifeste, permissions, `adminPages`, `entries.admin` | Guide modules / manifeste | `docs/MODULES.md` §2 ; developers `/docs/modules/manifeste` |
| `defineServerModule`, `ctx.admin.*`, `ctx.db`, `ctx.storage`, `ctx.lock`, `ctx.files`, `ctx.mail`, `ctx.fetch`+`net:hôte` | Contexte serveur | developers `/docs/modules/serveur` ; `sdk/index.ts` `ServerContext` |
| `defineAdminModule` + kit UI | Admin modules | `@snapify/sdk/admin` ; ex. `modules/ai-articles` |
| Collections JSON (256 Ko/doc) | Base de données modules | `/docs/modules/base-de-donnees` |
| Background « jobs » | **Pas d’API jobs** — pattern `setInterval` + cleanup au deactivate | Exemple doc serveur (`setInterval` / `clearInterval`) |
| SEO natif Snapify | `SeoMeta` pages/posts + `redirects` | `server/cms/types.ts` ; admin `PUT /api/admin/pages/:id`, `PUT /api/admin/redirects` |
| Paquet `.snapmod`, signature, marketplace | Paquets / publier | `/docs/paquets`, `/docs/publier` |

## 3. Architecture module

```
modules/wp-seo-migrator/
├── snapify.module.json
├── ARCHITECTURE.md          ← ce plan
├── README.md
├── wp-plugin/               ← Snapify Exporter (PHP) téléchargeable
├── fixtures/                ← Yoast, Rank Math, WXR, redirections
├── src/
│   ├── types.ts             ← SeoRecord normalisé + SeoConnector
│   ├── i18n/                ← fr / en / ar (RTL)
│   ├── connectors/          ← interface + Yoast, RankMath, WXR, Redirection, Exporter, CSV
│   ├── pipeline/            ← merge, score, redirects, apply-plan, report
│   ├── server.ts            ← admin routes + worker setInterval
│   └── admin/               ← 4 écrans (wizard)
└── tests/
```

### Flux MVP

1. **Connexion** — URL affichée pour contexte + upload (Exporter / WXR / CSV). Options avancées repliées.
2. **Analyse** — connecteurs détectés, compteurs lisibles, score de couverture.
3. **Aperçu** — problèmes en langage simple, avant/après 5 pages, tout pré-coché, mode Expert masqué.
4. **Migration** — job en base (`migrations` + `migration_items`), worker `setInterval`, progression, annulation, rapport CSV.

### Fusion multi-connecteurs

`SeoConnector` déclare `fields[]` + `detect()` + `extract()`.  
Merge par champ : source la plus riche d’abord ; chaque valeur garde `sources[field]=connectorId`.

### Application dans Snapify (repli documenté)

Le SDK **n’expose pas** d’API pour écrire pages/SEO/redirections CMS.  
**Repli MVP** : le serveur produit un *apply plan* ; l’UI admin (session déjà authentifiée, mêmes cookies) appelle les routes host documentées :

- `GET/PUT /api/admin/pages` / `PUT /api/admin/pages/:id` (seo)
- `GET` pages+posts puis `PUT /api/admin/redirects`

Nécessite les droits `seo.edit` (et `pages.edit` si création de pages — hors MVP : on ne crée pas de contenu, on mappe le SEO sur les chemins existants + redirections 301).

## 4. Lacunes doc / SDK (explicites) + replis

| Lacune | Impact | Repli choisi |
| --- | --- | --- |
| ~~Pas de `net:*` dynamique~~ | ~~Impossible d’appeler un WP arbitraire~~ | **Résolu (1.2)** : permissions core `net:outbound` (HTTP(S) anti-SSRF) + `net:ftp` (`ctx.ftp`). Analyse auto URL-first ; fichiers = expert uniquement. |
| Pas d’API jobs / queue | Migrations longues | `setInterval` + `ctx.lock` + collections `migrations` / `items` ; reprise au redémarrage |
| Pas de `ctx.cms` / écriture SEO | Appliquer title/meta/canonical/redirects | Apply plan + appels `/api/admin/*` depuis l’UI admin (session) |
| Pas de GSC/GA OAuth module | Priorisation trafic | Option CSV GSC upload (MVP partiel) ; OAuth v2 |
| Schema JSON-LD riche limité dans `SeoMeta` | Snapify : `schemaType` enum simple | Stocker JSON-LD brut dans meta module + mapper `schemaType` au plus proche ; rapport « schema avancé à revérifier » |
| Surveillance 404 / trafic 30 j | Pas d’API analytics module complète | Collection `watch_hits` + lecture basique via routes admin ; alertes mail `mail:send` si SMTP configuré |
| PDF rapport | Pas de PDF dans SDK | CSV + HTML téléchargeable (PDF v2) |
| i18n admin RTL | Kit admin non i18né | Dictionnaires fr/en/ar dans le module + `dir=rtl` pour ar |

## 5. Permissions manifeste (minimales)

`admin:routes`, `database`, `storage`, `files`, `mail:send`, `site:read`  
Pas de `net:` en MVP (fichier-first).  
Pas de `http:routes` public (tout passe par admin).

## 6. Sécurité

- Identifiants WP (si saisis en expert) : chiffrés via secret dérivé `storage` + purge après job (`credentialsClearedAt`).
- Uploads : types MIME/extensions allowlist, taille max, parse sandbox.
- Sanitize XSS dans title/meta/JSON-LD avant écriture.
- Apply non destructif : dry-run par défaut ; confirmation avant écriture ; bouton Annuler.

## 7. Livré / reste

**MVP 1.0.0** (publié marketplace, éditeur Hamdi Ayari) : WXR + Yoast CSV + Rank Math CSV + Redirection + Exporter JSON + 4 écrans + worker + apply SEO/redirects + rapport + tests.

**1.1.0** : AIOSEO / SEOPress / TSF / Slim SEO CSV ; Screaming Frog / Semrush / Ahrefs CSV ; `.htaccess` / nginx ; sitemap XML ; GSC CSV (priorisation) ; HTML rendu (secours) ; gabarit `CUSTOM_CONNECTOR.md` + `createCsvSeoConnector`.

**Reste (roadmap v2)** : Squirrly / SmartCrawl / Platinum / builders Divi·Elementor meta natives ; Safe Redirect Manager REST ; WPML / Polylang / Weglot hreflang riches ; WooCommerce marques/GTIN ; ACF/Schema Pro ; crawl live + REST Application Password (`net:outbound` core) ; GSC OAuth ; PDF ; MySQL lecture seule.

### Correctif build SDK (publication)

Rolldown embarquait React (+ `process.env`) dans `server.mjs` via le re-export `recaptcha` de `@snapify/sdk`. Correctifs : type `ComponentType` local dans `sdk/index.ts`, reCAPTCHA via `@snapify/sdk/recaptcha`, garde-fou build serveur.

## 8. Questions ouvertes (produit)

1. Pages absentes dans Snapify : brouillons SEO vs 301 uniquement ?
2. Tarification marketplace : rester `free` ?
3. Priorité v2 : live WP (`net:outbound`) ou connecteurs multilingue / Woo ?

---

*Statut : 1.1.0 — connecteurs A/B/F étendus ; C/D/E riches et live net en v2.*
