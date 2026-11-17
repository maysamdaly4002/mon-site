#!/usr/bin/env bash
# Appelé par un endpoint léger ou manuellement après push GitHub
set -euo pipefail
cd /home/snapify
git fetch origin main
git reset --hard origin/main
bash scripts/deploy.sh origin/main
