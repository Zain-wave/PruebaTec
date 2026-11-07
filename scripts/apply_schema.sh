#!/usr/bin/env bash
# Aplica sql/schema.sql (y con --seed, sql/seed.sql) usando DATABASE_URL de tu .env local.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && { set -a; . ./.env; set +a; }
: "${DATABASE_URL:?Define DATABASE_URL en .env (ver .env.example)}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/schema.sql
if [ "${1:-}" = "--seed" ]; then psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/seed.sql; fi
echo "Listo."
