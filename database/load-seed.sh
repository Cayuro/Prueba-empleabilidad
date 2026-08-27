#!/usr/bin/env bash
# =============================================================================
# Script: load-seed.sh
# Description: Populates PostgreSQL with Riwi seed data from load-seed.sql
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/seeds/load-seed.sql"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bd_juan_gomez_hamilton}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

echo "=========================================================="
echo " Loading Seed Data into PostgreSQL: ${DB_NAME}"
echo " Host: ${DB_HOST}:${DB_PORT} | User: ${DB_USER}"
echo "=========================================================="

if [ ! -f "${SQL_FILE}" ]; then
    echo "Error: Seed SQL file not found at ${SQL_FILE}" >&2
    exit 1
fi

if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${SQL_FILE}"
else
    docker exec -i rw_database psql -U "${DB_USER}" -d "${DB_NAME}" < "${SQL_FILE}"
fi

echo "=========================================================="
echo " Seed data successfully loaded into ${DB_NAME}!"
echo "=========================================================="
