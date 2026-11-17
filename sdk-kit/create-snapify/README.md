# create-snapify

Crée un projet de module ou de thème pour [Snapify](https://snapify.tn), le CMS de NOVALABS.

```bash
npm create snapify@latest
```

L’outil pose quelques questions (module ou thème, dossier, nom d’éditeur…) puis prépare le projet : manifeste, sources React et TypeScript, scripts npm.

```bash
cd mon-module
npm install
npm run build
```

Sans questions :

```bash
npm create snapify@latest mon-module -- --id monagence.mon-module
npm create snapify@latest mon-theme -- --theme --id monagence.mon-theme
```

Ce paquet lance `snapify create` du kit développeur [`snapify-sdk`](https://www.npmjs.com/package/snapify-sdk).

Documentation : <https://developers.snapify.tn/docs/kit-developpeur>

© 2026 NOVALABS WEB DESIGN — Tunisie. Licence : voir `LICENSE.md`.
