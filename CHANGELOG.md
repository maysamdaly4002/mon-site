# Changelog

Toutes les versions notables de Snapify sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versionnement [SemVer](https://semver.org/lang/fr/).

## [1.1.0] — 2026-10-20

### Ajouté
- Marketplace backoffice en cartes (logo, captures, galerie)
- Achat de modules payants depuis le backoffice (Flouci + licence auto)
- Superadmin ops (newsletter, tickets, factures, Flouci, paramètres)
- Community, marketplace publique, portail développeurs
- Widgets CMS (zones sidebar/footer), menus dynamiques, aperçu articles
- Blocs group/columns et modèles de blocs sauvegardés
- CI/CD GitHub Actions (lint, build, déploiement SSH, releases)

### Modifié
- Sidebar admin : sections **Éditorial** / **Applications** / **Messagerie**
- Catalogue modules (prix, galerie, captures)

### Sécurité
- `.env` retiré du suivi Git ; secrets uniquement via `.env` serveur / GitHub Secrets

## [1.0.0] — 2026-10-01

### Ajouté
- Première version publique Snapify (CMS, thèmes, modules, marketplace locale)
