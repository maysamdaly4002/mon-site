#!/usr/bin/env bash
# CD de secours si GitHub Actions est indisponible (startup_failure sur le compte).
# Installe : crontab -e → */5 * * * * /home/snapify/scripts/auto-deploy-poll.sh >> /var/log/snapify-deploy.log 2>&1
set -euo pipefail
ROOT=/home/snapify
cd "$ROOT"
git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "$(date -Is) deploy $LOCAL → $REMOTE"
  bash "$ROOT/scripts/deploy.sh" origin/main
fi
