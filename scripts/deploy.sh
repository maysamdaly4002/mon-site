#!/usr/bin/env bash
# Snapify — déploiement sur le serveur (GitHub Actions → SSH Host hamdi)
# Usage : DEPLOY_PATH=/home/snapify ./scripts/deploy.sh [git-ref]
set -euo pipefail

ROOT="${DEPLOY_PATH:-/home/snapify}"
REF="${1:-origin/main}"
APP_NAME="${PM2_APP_NAME:-snapify}"

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERREUR : $ROOT/.env manquant — configuration locale requise, non versionnée."
  exit 1
fi

echo "==> git fetch / reset $REF"
git fetch --prune origin
git checkout -B main
git reset --hard "$REF"

echo "==> npm ci"
# NODE_ENV=production sur le serveur omet les devDependencies — tsx/esbuild sont en dependencies
NODE_ENV=development npm ci --no-audit --no-fund --legacy-peer-deps

echo "==> build"
NODE_ENV=development npm run build

echo "==> pm2 restart $APP_NAME"
command -v pm2 >/dev/null 2>&1 || { echo "pm2 introuvable"; exit 1; }
pm2 restart "$APP_NAME" --update-env
pm2 save || true

echo "==> OK $(git rev-parse --short HEAD) · $(date -Is)"
