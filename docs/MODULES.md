<!--
  Snapify
  © 2026 NOVALABS WEB DESIGN — Tunisie
  Contact : contact@novalabs.tn · +216 24 734 647
  Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
-->

# Modules et thèmes Snapify — guide développeur

> Version publique et à jour de ce guide : https://developers.snapify.tn

> Les thèmes (`.snaptheme`) reposent sur le même système de paquets, de signature et de licence : voir la [section 10](#10-thèmes).

Un module ajoute une fonctionnalité au CMS sans toucher au cœur : un composant affiché sur le site, éventuellement une API côté serveur, et des réglages que l'administration génère automatiquement à partir du manifeste.

Les modules sont distribués sous forme de paquets **`.snapmod` signés par NOVALABS**. Un site Snapify n'installe que des paquets dont la signature est valide (sauf en mode développeur), revérifie l'intégrité de chaque fichier à chaque démarrage et contrôle la licence du module.

Modules de référence : [`modules/whatsapp`](../modules/whatsapp) (public uniquement) et [`modules/ai-chat`](../modules/ai-chat) (public + serveur).

---

## 1. Structure d'un module

```
modules/mon-module/
├── snapify.module.json   # manifeste (obligatoire)
├── README.md             # optionnel, inclus dans le paquet
└── src/
    ├── public.tsx        # composant(s) affiché(s) sur le site
    └── server.ts         # code serveur (optionnel)
```

Les sources importent uniquement `react`, `@snapify/sdk` et des dépendances qui seront intégrées au bundle (ex. `lucide-react`). React est partagé avec le site : il n'est jamais embarqué dans le module.

## 2. Manifeste `snapify.module.json`

```json
{
  "id": "editeur.mon-module",
  "name": "Mon module",
  "version": "1.0.0",
  "description": "Ce que fait le module, en une ou deux phrases.",
  "author": { "name": "Éditeur", "email": "contact@editeur.tn", "url": "https://editeur.tn" },
  "pricing": "free",
  "category": "Contact",
  "icon": "sparkles",
  "engines": { "snapify": "^1.0.0" },
  "permissions": ["http:routes"],
  "slots": ["floating"],
  "entries": { "public": "src/public.tsx", "server": "src/server.ts" },
  "settings": [
    { "key": "title", "type": "text", "group": "Apparence", "label": "Titre", "default": "Bonjour", "public": true, "maxLength": 60 }
  ]
}
```

| Champ | Règle |
| --- | --- |
| `id` | `editeur.nom`, minuscules, chiffres et tirets (`^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$`). Ne change jamais. |
| `version` | SemVer `x.y.z`. Une version supérieure est proposée comme mise à jour. |
| `pricing` | `free` ou `paid`. Un module payant exige une licence pour s'activer. |
| `icon` | `bot`, `calendar`, `chart-bar`, `database`, `globe`, `mail`, `message-circle`, `messages-square`, `phone`, `search`, `shopping-cart`, `sparkles` (sinon icône générique). |
| `engines.snapify` | Version d'API requise : `*`, `1.0.0`, `>=1.0.0` ou `^1.0.0`. L'API actuelle est `1.3.0`. |
| `slots` | Emplacements où le module s'affiche. Disponible : `floating` (éléments fixés à l'écran). |
| `entries` | `public` et/ou `server`, chemins relatifs vers les sources. |

### Réglages

Chaque entrée de `settings` devient un champ dans l'administration (page du module). Les valeurs sont validées côté serveur avant d'être enregistrées.

| `type` | Valeur | Options utiles |
| --- | --- | --- |
| `boolean` | `true` / `false` | |
| `text`, `phone` | chaîne | `maxLength`, `placeholder` |
| `textarea` | chaîne | `rows`, `maxLength`, `monospace` |
| `number` | nombre | `min`, `max`, `step`, `slider` |
| `select` | une des `options[].value` | `options` |
| `paths` | liste d'adresses (`/contact/`, `/blog/*`) | vide = toutes les pages |

Options communes : `key`, `label`, `help`, `group` (titre de la section), `default`, `required`.

**`public: true`** expose la valeur au navigateur. Tout ce qui n'est pas marqué `public` (prompt système, quotas, choix du modèle…) reste exclusivement côté serveur.

## 3. Partie publique

```tsx
import { definePublicModule, matchesPaths, type PublicModuleProps } from '@snapify/sdk';

interface Settings { title: string; showOnPages: string[] }

function Widget({ settings, site, path, isPreview, navigate, api }: PublicModuleProps<Settings>) {
  if (!matchesPaths(settings.showOnPages, path)) return null;
  return (
    <button className="fixed bottom-5 right-5 rounded-full bg-px-primary px-4 py-2 text-white" onClick={() => navigate('/contact/')}>
      {settings.title} — {site.name}
    </button>
  );
}

export default definePublicModule<Settings>({ slots: { floating: Widget } });
```

Props reçues :

- `settings` : réglages publics ;
- `site` : nom, téléphone, e-mail, adresse du site ;
- `path` : page affichée ; `isPreview` : `true` dans l'aperçu de l'éditeur ;
- `navigate(path)` : navigation interne sans rechargement ;
- `api.get(route)` / `api.post(route, body)` : appels vers la partie serveur du module (`/api/modules/<id>/<route>`).

**Styles.** Tailwind est compilé avec le module ; seules les classes réellement utilisées sont incluses. Les couleurs du site sont disponibles via `px-*` (`bg-px-primary`, `text-px-navy`…), ce qui garde le module aligné sur l'identité visuelle choisie dans l'administration. À la compilation, la feuille de style est limitée au conteneur du module (`[data-snapify-scope="<id>"]`) : elle ne peut pas modifier l'apparence du thème ni des autres modules. Une erreur dans un module est isolée : elle n'affecte ni le site ni les autres modules.

## 4. Partie serveur

```ts
import { defineServerModule, type ServerContext } from '@snapify/sdk';

interface Settings { greeting: string }

export default defineServerModule<Settings>({
  activate(ctx: ServerContext<Settings>) {
    ctx.http.post('/hello', async (req) => {
      const name = typeof req.body?.name === 'string' ? req.body.name.slice(0, 50) : '';
      if (!name) throw ctx.error(400, 'Nom manquant');
      const count = ((await ctx.storage.get<number>('count')) ?? 0) + 1;
      await ctx.storage.set('count', count);
      return { message: `${ctx.settings().greeting} ${name}`, count };
    });

    ctx.admin.status(async () => ({
      stats: [{ label: 'Appels', value: (await ctx.storage.get<number>('count')) ?? 0 }],
    }));
  },
});
```

Chaque capacité du contexte est liée à une permission déclarée dans le manifeste ; sans elle, l'appel échoue.

| API | Permission | Rôle |
| --- | --- | --- |
| `ctx.http.get/post(route, handler)` | `http:routes` | Routes publiques sous `/api/modules/<id>/…` (120 requêtes/min/IP, 60 s max). |
| `ctx.env(NOM)` | `env:NOM` | Lire une variable d'environnement précise (clé d'API…). |
| `ctx.fetch(url, init)` | `net:hôte` ou `net:outbound` | HTTPS vers un hôte déclaré, ou HTTP(S) public anti-SSRF (`net:outbound`, redirections limitées). |
| `ctx.ftp.list` / `ctx.ftp.readText` | `net:ftp` | Lecture FTP/FTPS contrôlée (exports SEO, `.htaccess`…) — pas de socket brut dans le module. |
| `ctx.site()` | `site:read` | Informations publiques du site (nom, coordonnées, couleurs, URL). |
| `ctx.storage.get/set/delete` | `storage` | Données propres au module, en base (supprimées à la désinstallation). |
| `ctx.settings()`, `ctx.log`, `ctx.error()`, `ctx.admin.status()` | — | Toujours disponibles. |

`ctx.error(status, message)` renvoie une erreur propre au visiteur ; toute autre exception renvoie une erreur 500 générique et est journalisée côté serveur. `ctx.admin.status()` alimente les statistiques et alertes affichées en haut de la page du module dans l'administration.

## 5. Construire, signer, publier

Commandes (depuis la racine du projet) :

```bash
# Construire et signer un paquet (sortie : marketplace/packages/<id>-<version>.snapmod)
SNAPIFY_SIGNING_KEY=~/.snapify/keys/novalabs-2026.pem npm run module -- build modules/mon-module

# Paquet non signé, pour tester en mode développeur
npm run module -- build modules/mon-module --unsigned

# Vérifier un paquet (signature, empreintes, manifeste)
npm run module -- verify marketplace/packages/editeur.mon-module-1.0.0.snapmod

# Régénérer le catalogue local marketplace/catalog.json
npm run module -- catalog

# Émettre une licence (module payant ou licence nominative)
SNAPIFY_SIGNING_KEY=… npm run module -- license --module editeur.mon-module \
  --licensee "Client SARL" --domains client.tn,*.client.tn --plan standard --expires 2027-12-31

# Créer une nouvelle paire de clés (une seule fois, à conserver hors du dépôt)
npm run module -- keygen --out ~/.snapify/keys --kid novalabs-2027
```

La clé publique affichée par `keygen` doit être ajoutée à `TRUSTED_KEYS` dans `server/modules/trust.ts` ; c'est ce qui permet de faire tourner les clés sans invalider les paquets existants. **La clé privée ne doit jamais être versionnée ni copiée sur un serveur de production.**

Pour un module gratuit signé, `build` intègre automatiquement une licence gratuite valable sur tous les domaines.

### Développeurs tiers

Les développeurs externes n'ont pas accès à ce dépôt : ils utilisent le kit public publié sur npm (documentation :
https://developers.snapify.tn/docs/kit-developpeur).

1. `npm create snapify@latest` crée le projet ; `npm run build` produit un paquet non signé et rejoue l'analyse marketplace.
2. Ils testent sur un site en mode développeur (`SNAPIFY_MODULES_DEV_MODE=true`), s'ils en ont un.
3. Ils envoient le paquet depuis leur espace vendeur de la marketplace ; NOVALABS le relit, le teste, puis le signe à l'approbation.

### Kit développeur public (npm)

Sources : `sdk-kit/` (outil `snapify`, modèles, README, licence, journal des versions) et `sdk-kit/create-snapify/`.
Paquets npm : `snapify-sdk` (SDK + outil, importé par les projets sous l'alias `@snapify/sdk`) et `create-snapify`
(`npm create snapify`), publiés par le compte npm de NOVALABS. Le nom `snapify` n'est pas disponible sur npm.

```bash
# 1. Augmenter "version" dans sdk-kit/package.template.json et compléter sdk-kit/CHANGELOG.md
# 2. Construire : releases/sdk/ (téléchargements du portail, sommes SHA-256, index.json) et releases/npm/
npm run sdk:pack
# 3. Contrôler sans publier
npm run sdk:publish -- --dry-run
# 4. Publier snapify-sdk puis create-snapify (double authentification du compte npm requise)
npm run sdk:publish -- --otp 123456
#    ou, avec une clé de sécurité / Windows Hello : approbation dans le navigateur
npx -y npm@11 publish releases/npm/snapify-sdk-<version>.tgz --access public --auth-type=web
npx -y npm@11 publish releases/npm/create-snapify-<version>.tgz --access public --auth-type=web
```

Une version publiée sur npm ne peut plus être modifiée : toute correction passe par une nouvelle version. `sdk:pack` refuse
d'écraser une version existante (`--force` réservé aux essais locaux, jamais après publication). Le script de publication vérifie
que l'archive npm est identique au téléchargement de developers.snapify.tn.

## 6. Format du paquet `.snapmod`

JSON compressé en gzip :

```json
{
  "format": "snapmod/1",
  "manifest": { "…manifeste…": "", "entries": { "public": "public.js", "server": "server.mjs" }, "styles": "public.css",
                "files": { "public.js": { "sha256": "…", "size": 1234 } }, "builtAt": "…" },
  "files": { "public.js": "<base64>", "public.css": "<base64>", "server.mjs": "<base64>" },
  "signature": { "alg": "ed25519", "kid": "novalabs-2026", "value": "<base64>" },
  "license": "SNAPIFY-LIC-…"
}
```

- La signature Ed25519 porte sur le JSON canonique (clés triées) du manifeste, qui contient l'empreinte SHA-256 et la taille de chaque fichier : modifier un seul octet invalide le paquet.
- Fichiers autorisés : `public.js`, `public.css`, `server.mjs`, `README.md`. Taille maximale : 20 Mo compressé, 40 Mo décompressé.
- Licence : `SNAPIFY-LIC-` + base64url de `{ payload: { v, licenseId, moduleId, licensee, plan, domains, issuedAt, expiresAt }, signature }`. Elle est vérifiée hors ligne : signature, module, date d'expiration, et domaine de l'URL publique du site (Paramètres). `*` couvre tous les domaines, `*.exemple.fr` les sous-domaines ; `localhost` est toujours accepté.

## 7. Catalogue distant

Par défaut, la marketplace lit `marketplace/catalog.json`. Pour un catalogue central, définissez `MARKETPLACE_URL` (HTTPS obligatoire) vers un fichier au même format :

```json
{
  "format": "snapify-catalog/1",
  "modules": [
    { "id": "…", "name": "…", "version": "…", "…": "champs du manifeste",
      "package": "packages/editeur.mon-module-1.0.0.snapmod", "sha256": "…", "size": 15739, "signed": true }
  ]
}
```

`package` est résolu relativement à l'URL du catalogue. Le paquet téléchargé doit correspondre à `sha256`, puis passe par les mêmes vérifications qu'un import manuel. En cas d'indisponibilité, le catalogue local est affiché.

## 8. Modèle de sécurité

| Contrôle | Moment |
| --- | --- |
| Signature NOVALABS du manifeste et empreintes des fichiers | Import, téléchargement, chaque démarrage, chaque activation |
| Compatibilité de l'API (`engines.snapify`) | Installation et démarrage |
| Licence (signature, module, domaine, expiration) | Installation, saisie de clé, démarrage, toutes les 10 minutes |
| Permissions du contexte serveur | À chaque appel |
| Réglages validés selon leur schéma ; seuls les réglages `public` atteignent le navigateur | Enregistrement et diffusion |
| Fichiers publics servis depuis la copie vérifiée en mémoire ; `server.mjs` jamais exposé | Chaque requête |

Un module dont un contrôle échoue est **bloqué** (non chargé sur le site, routes désactivées) et signalé dans l'administration avec la raison. Une réinstallation depuis la marketplace répare un module altéré en conservant ses réglages.

**Limite à connaître :** le code serveur d'un module s'exécute dans le processus Node du site. Les permissions encadrent l'API fournie, mais ne constituent pas un bac à sable : un code malveillant pourrait importer directement des modules Node. C'est pourquoi la confiance repose sur la **revue et la signature par NOVALABS** ; le mode développeur, qui accepte les paquets non signés, ne doit jamais être activé en production.

## 9. Administration

- **Marketplace** (super administrateur) : catalogue, installation et mise à jour, import manuel d'un `.snapmod`. Chaque installation passe par un écran de confirmation qui montre la provenance, la signature, la licence et les permissions demandées.
- **Modules installés** (super administrateur et éditeur) : état, activation, accès aux réglages. Chaque module configurable a aussi son entrée dans le menu.
- **Page du module** : statistiques fournies par le module, réglages générés, licence (saisie ou remplacement de clé), sécurité et permissions, désinstallation.

Les fichiers installés se trouvent dans `data/modules/<id>/<version>/`, l'état et les réglages dans les tables `modules` et `module_storage`.

## 10. Thèmes

Un thème fournit toute la présentation du site : en-tête, pied de page, rendu des 25 types de blocs, mise en page des pages et des articles, page 404. Le contenu (pages, menus, articles, identité visuelle) ne dépend pas du thème : changer de thème ne modifie aucune donnée. Le site hôte garde la navigation, le chargement des données, l'aperçu de l'éditeur, la bannière cookies, le mode maintenance, les statistiques et les modules.

Le thème livré par défaut, **SidiBou** (`novalabs.sidibou`), est la landing d'origine. Ses sources sont dans `themes/sidibou/` et servent d'exemple complet.

### Structure

```
themes/mon-theme/
  snapify.theme.json    manifeste (mêmes champs qu'un module, sans permissions ni slots)
  screenshot.jpg        capture 4:3 (JPEG, PNG ou WebP, 2 Mo max), affichée dans l'administration
  src/index.tsx         point d'entrée : export default defineTheme({...})
  src/styles.css        importé depuis l'entrée ; Tailwind est disponible
```

Différences avec un module : `kind` vaut `theme` (déduit du nom du manifeste), `entries.public` est obligatoire, `entries.server`, `permissions` et `slots` sont interdits. Les réglages (`settings`) deviennent les **options du thème**, toutes transmises au navigateur et modifiables dans *Apparence > Personnaliser*.

### Contrat

```tsx
import { defineTheme, useSnapify } from '@snapify/sdk/theme';
import type { BlockProps } from '@snapify/sdk/theme';

function Header({ path, navigate }) {
  const { site, info, settings } = useSnapify<{ sticky: boolean }>();
  // site : configuration publique (menus, identité visuelle…), info : coordonnées
  return <header>…</header>;
}

export default defineTheme({
  Header,
  Footer: ({ navigate, openCookies }) => <footer>…</footer>,
  Layout: ({ children }) => <>{children}</>,           // facultatif : applique les options
  Page: ({ page, children }) => <main>{children}</main>, // facultatif
  Post: ({ post, children }) => <article>{children}</article>, // facultatif
  NotFound: ({ navigate }) => <p>Page introuvable</p>, // facultatif
  blocks: {
    hero: ({ d, style }: BlockProps<'hero'>) => <section>{d.title}</section>,
    // un bloc sans rendu n'est pas affiché (l'aperçu de l'éditeur le signale)
  },
});
```

- `@snapify/sdk/theme` : `defineTheme`, `useSnapify()` (site, coordonnées, variables `{{…}}`, options, adresse, navigation, `isPreview`), `isPreviewMode()`.
- `@snapify/sdk/content` : types des blocs, pages, articles et de la configuration, `applyTokens()`.
- `@snapify/sdk/icons` : icônes disponibles dans l'éditeur de blocs.

React est fourni par le site (non inclus dans le bundle). Chaque partie du thème est isolée : une erreur dans un bloc, l'en-tête ou le pied de page n'affecte pas le reste de la page.

### Construire et publier

Mêmes commandes que pour un module ; le paquet produit est un `.snaptheme` :

```bash
SNAPIFY_SIGNING_KEY=~/.snapify/keys/novalabs-2026.pem npm run module -- build themes/mon-theme
npm run module -- catalog   # ajoute le thème et sa capture (marketplace/screenshots/)
```

Dans un catalogue distant, une entrée de thème porte `"kind": "theme"` et `"screenshot"` (chemin relatif au catalogue, servi en HTTPS).

### Fonctionnement

- Un seul thème est actif à la fois. Un thème installé n'est pas activé automatiquement s'il en existe déjà un actif.
- Au premier démarrage, SidiBou est installé depuis le catalogue local et activé.
- La feuille de style, le script et la description du thème actif sont inclus dans le HTML : pas de flash sans style, et un changement de thème est visible immédiatement.
- **Aperçu** : un thème installé mais inactif peut être prévisualisé (et ses options réglées) dans *Personnaliser* avant activation. Ses fichiers sont servis à cette fin dès lors que ses vérifications sont satisfaites.
- Signature, empreintes, licence et compatibilité sont contrôlées comme pour les modules. Si le thème actif est bloqué, le site s'affiche avec un rendu minimal (menu, titres, textes) en attendant une réparation ou l'activation d'un autre thème.
- Le thème actif ne peut pas être supprimé.

### Administration

Menu **Apparence** :

- **Thèmes** : thèmes installés (capture, activation, aperçu, suppression), onglet *Ajouter un thème* alimenté par la marketplace, import manuel d'un `.snaptheme`.
- **Personnaliser** : options du thème avec aperçu en direct (ordinateur, tablette, mobile, choix de la page) ; pour un thème inactif, *Enregistrer et activer*.
- **Identité visuelle** : logo, couleurs et polices, communs à tous les thèmes (variables CSS `--px-*`).
