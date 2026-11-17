# Journal des versions

## 1.3.1 — 15 octobre 2026

- Le kit est publié sur le registre npm sous le nom `snapify-sdk` ; les projets l’installent sous l’alias `@snapify/sdk`
  (`"@snapify/sdk": "npm:snapify-sdk@^1.3.1"`), sans changer les imports.
- Nouveau paquet `create-snapify` : `npm create snapify@latest`.
- `snapify create` sans dossier pose ses questions dans le terminal (module ou thème, dossier, éditeur, nom, auteur, e-mail).

## 1.3.0 — 15 octobre 2026

Première version publique du kit développeur.

- SDK des modules et des thèmes (API Snapify 1.3) avec déclarations TypeScript.
- Outil `snapify` : `create` (modèles de module et de thème), `build`, `check`, `verify`.
- `snapify build` et `snapify check` rejouent l’analyse de la marketplace sur le poste du développeur.
- Paquets non signés : la signature NOVALABS est apposée lors de la revue marketplace.
