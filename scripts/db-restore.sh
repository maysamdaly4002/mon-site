#!/usr/bin/env bash
# Snapify
# © 2026 NOVALABS WEB DESIGN — Tunisie
# Contact : contact@novalabs.tn · +216 24 734 647
# Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
# Restaure une sauvegarde : scripts/db-restore.sh backups/db/snapify-AAAAMMJJ-HHMMSS.dump
set -euo pipefail
FILE="${1:?Usage : scripts/db-restore.sh <fichier.dump>}"
docker exec -i snapify-postgres pg_restore -U snapify -d snapify --clean --if-exists --no-owner < "$FILE"
pm2 restart snapify
echo "Base restaurée depuis $FILE"
