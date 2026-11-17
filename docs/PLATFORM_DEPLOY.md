# Community + Marketplace — déploiement

## DNS

| Host | Cible |
|------|--------|
| `community.snapify.tn` | même serveur que `snapify.tn` |
| `marketplace.snapify.tn` | même serveur que `snapify.tn` |

## Nginx (extrait)

```nginx
server {
  server_name community.snapify.tn marketplace.snapify.tn snapify.tn;
  location / {
    proxy_pass http://127.0.0.1:3020;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## Variables d’environnement

Voir `.env.example` : `COMMUNITY_HOST`, `MARKETPLACE_HOST`, `MARKETPLACE_PUBLIC_URL`,
`PLATFORM_COOKIE_DOMAIN=.snapify.tn`, clés Flouci, `FLOUCI_MOCK=false` en production.

Pour que le CMS Snapify installe depuis la marketplace en ligne :

```env
MARKETPLACE_URL=https://marketplace.snapify.tn/api/marketplace/catalog.json
```

## Comptes seed

| Rôle | E-mail | Mot de passe (dev) |
|------|--------|--------------------|
| Admin plateforme | `PLATFORM_ADMIN_EMAIL` (défaut `admin@snapify.tn`) | `PLATFORM_ADMIN_PASSWORD` |
| Développeur démo | `dev@snapify.tn` | `Developer1` |

## Dev local

Ajoutez dans `/etc/hosts` :

```
127.0.0.1 community.localhost marketplace.localhost
```

Puis ouvrez `http://community.localhost:PORT` et `http://marketplace.localhost:PORT`.
Fallback : `http://localhost:PORT/?app=community` ou `?app=marketplace`.

Avec `FLOUCI_MOCK=true`, les paiements (achat + inscription 100 DT) sont confirmés immédiatement.
