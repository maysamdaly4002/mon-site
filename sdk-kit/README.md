# snapify-sdk — kit développeur Snapify

SDK, outil de compilation et analyse marketplace pour créer des **modules** (`.snapmod`) et des **thèmes** (`.snaptheme`)
pour le CMS [Snapify](https://snapify.tn).

- Documentation : https://developers.snapify.tn/docs
- Kit, versions et sommes de contrôle : https://developers.snapify.tn/docs/kit-developpeur
- Marketplace : https://marketplace.snapify.tn

## Prérequis

Node.js 20.19+ ou 22.12+, npm 10+.

## Démarrer

```bash
npm create snapify@latest
```

L’outil demande s’il s’agit d’un module ou d’un thème, le dossier et votre nom d’éditeur, puis prépare le projet.

```bash
cd mon-module
npm install
npm run build
```

`npm run build` produit `dist/<id>-<version>.snapmod` puis lance **la même analyse que la marketplace** :
manifeste, permissions, code, sécurité, présentation. Un paquet qui passe ici passe à l’envoi.

Sans questions (intégration continue, scripts) :

```bash
npm create snapify@latest mon-module -- --id monagence.mon-module
npm create snapify@latest mon-theme -- --theme --id monagence.mon-theme
```

## Ajouter le SDK à un projet existant

Le code des extensions importe le SDK sous le nom `@snapify/sdk`. Installez le paquet `snapify-sdk` sous ce nom :

```bash
npm install --save-dev @snapify/sdk@npm:snapify-sdk@^__SDK_VERSION__
```

> Le nom `@snapify/sdk` du registre npm n’appartient pas à NOVALABS : n’installez jamais `npm install @snapify/sdk` seul.
> Le paquet officiel est `snapify-sdk`, publié par NOVALABS.

## Commandes

| Commande | Rôle |
| --- | --- |
| `snapify create [dossier] [--theme] [--id editeur.nom] [--name "Nom"] [--author "Nom"] [--email adresse]` | Nouveau projet de module ou de thème (sans dossier : questions) |
| `snapify build [dossier] [--out dist] [--no-check]` | Compile le paquet puis l’analyse |
| `snapify check <paquet>` | Analyse d’un paquet, identique à celle de la marketplace |
| `snapify verify <paquet>` | Vérifie la signature NOVALABS et la licence d’un paquet reçu |

Dans un projet, lancez-les avec `npx snapify …` ou les scripts `npm run build` et `npm run typecheck`.

## Imports

| Import | Contenu |
| --- | --- |
| `@snapify/sdk` | Manifeste, partie publique (`definePublicModule`) et serveur (`defineServerModule`), types |
| `@snapify/sdk/admin` | Pages d’administration (`defineAdminModule`) et composants du back-office |
| `@snapify/sdk/theme` | Contrat des thèmes : `defineTheme`, `useSnapify`, `ModuleSlot` |
| `@snapify/sdk/content` | Types des blocs, pages, articles et configuration du site |
| `@snapify/sdk/commerce` | Contrat e-commerce partagé |
| `@snapify/sdk/image` | Préparation d’images dans le navigateur |
| `@snapify/sdk/icons` | Icônes de l’éditeur de blocs |

React est fourni par le site hôte à l’exécution : il n’est jamais inclus dans vos paquets.

## Signature et publication

Les paquets produits par le kit ne sont **pas signés**. Ils s’installent uniquement sur un site Snapify en mode développeur.
Pour publier, envoyez le paquet depuis votre espace vendeur sur la marketplace : après la revue, NOVALABS signe la version validée.

## Licence

Voir [LICENSE.md](LICENSE.md). © 2026 NOVALABS WEB DESIGN — Tunisie · contact@novalabs.tn
