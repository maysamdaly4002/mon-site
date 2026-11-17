# CI / CD Snapify

## Dépôt

- GitHub : https://github.com/hamdiayari-backup/snapify (privé)
- Branche de production : `main`

## Versions (SemVer)

| Commande | Effet |
|----------|--------|
| `npm version patch` | 1.1.0 → 1.1.1 |
| `npm version minor` | 1.1.0 → 1.2.0 |
| `npm version major` | 1.1.0 → 2.0.0 |

Puis : `git push origin main --follow-tags`  
Le workflow **Release** crée la release GitHub + archive `dist` sur chaque tag `v*.*.*`.

Depuis GitHub : Actions → **Release** → Run workflow → choisir patch / minor / major.

## Workflows

Tous tournent sur le **runner self-hosted `hamdi`** (ce serveur).

| Fichier | Déclencheur | Rôle |
|---------|-------------|------|
| `ci.yml` | push / PR `main` | `tsc` + `vite build` |
| `deploy.yml` | push `main` ou manuel | `scripts/deploy.sh` en local |
| `release.yml` | tag `v*` ou manuel | GitHub Release + archive `dist` |

## Serveur (alias SSH `hamdi`)

```sshconfig
Host hamdi
  HostName snapify.tn
  User root
  IdentityFile ~/.ssh/snapify_deploy
  IdentitiesOnly yes
```

Déploiement manuel :

```bash
ssh hamdi 'bash /home/snapify/scripts/deploy.sh origin/main'
# ou sur le serveur :
bash /home/snapify/scripts/deploy.sh origin/main
```

## Runner GitHub Actions

- Service systemd : `actions.runner.hamdiayari-backup-snapify.hamdi`
- Labels : `self-hosted`, `hamdi`, `production`
- Auth SSH : mots de passe désactivés ; alias `hamdi` → `snapify.tn` (clé `~/.ssh/snapify_deploy`)

Si les workflows restent en **`startup_failure`** (compte GitHub free / Actions non facturés) :

1. Vérifier sur GitHub → Settings → Actions → General → **Allow all actions**
2. Ou compter sur le **timer systemd** local (secours) :

```bash
systemctl status snapify-auto-deploy.timer
# toutes les 5 min : git fetch + deploy si origin/main a avancé
```

Le fichier `.env` **reste uniquement sur le serveur** (jamais dans Git).

