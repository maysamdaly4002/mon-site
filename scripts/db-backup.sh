#!/usr/bin/env bash
# Snapify
# © 2026 NOVALABS WEB DESIGN — Tunisie
# Contact : contact@novalabs.tn · +216 24 734 647
# Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
# Sauvegarde quotidienne de la base Snapify (format custom pg_dump, restaurable avec pg_restore).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/backups/db"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$DIR"
FILE="$DIR/snapify-$(date +%Y%m%d-%H%M%S).dump"
docker exec snapify-postgres pg_dump -U snapify -d snapify -Fc > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"
find "$DIR" -name 'snapify-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "Sauvegarde : $FILE"
