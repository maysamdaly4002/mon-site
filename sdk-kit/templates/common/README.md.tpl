# __NAME__

__KIND__ Snapify `__ID__`, créé avec le kit développeur Snapify __SDK_VERSION__ (API __API_VERSION__).

## Commandes

```bash
npm install          # installe le SDK et les outils
npm run build        # compile dist/__ID__-<version>__EXT__ puis l’analyse comme la marketplace
npm run typecheck    # vérifie les types TypeScript
```

`npx snapify check <paquet>` relance l’analyse d’un paquet, `npx snapify verify <paquet>` contrôle la signature d’un paquet reçu.

## Tester sur un site

Le paquet produit n’est pas signé : il ne s’installe que sur un site Snapify de développement
(`SNAPIFY_MODULES_DEV_MODE=true`), via **Administration › Modules › Importer**.
Ne publiez jamais un site de production en mode développeur.

## Publier

1. Inscrivez-vous comme développeur sur https://marketplace.snapify.tn/developer
2. Envoyez le fichier de `dist/` depuis votre espace vendeur : la même analyse est rejouée.
3. Après la revue, NOVALABS signe la version et la publie.

Documentation : https://developers.snapify.tn/docs
