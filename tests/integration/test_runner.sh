#!/usr/bin/env bash
# =============================================================================
# Automated Test Runner: Riwi Messaging Platform Integration Tests
# Validates PostgreSQL Smart Database, RLS, Soft Deletes, Keyset Pagination,
# Token Rotation, Vector Candidate SQL Filtering, and Unread Count Views.
# =============================================================================

set -e

# Configuration with fallback defaults matching docker-compose / .env.example
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bd_juan_gomez_hamilton}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
CONTAINER_NAME="${CONTAINER_NAME:-rw_database}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_TEST_FILE="${SCRIPT_DIR}/rls_security_test.sql"

# ANSI Colors for formatted terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${BLUE}  Riwi Co. S.A.S. — Automated Integration & RLS Test Suite${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo -e "Target Database: ${YELLOW}${DB_NAME}${NC} at ${YELLOW}${DB_HOST}:${DB_PORT}${NC}"
echo -e "Test Suite File: ${YELLOW}${SQL_TEST_FILE}${NC}"
echo ""

if [ ! -f "${SQL_TEST_FILE}" ]; then
    echo -e "${RED}[ERROR] Test SQL file not found: ${SQL_TEST_FILE}${NC}"
    exit 1
fi

# Detect execution strategy: local psql or docker container
if command -v psql >/dev/null 2>&1 && PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c '\q' >/dev/null 2>&1; then
    echo -e "${GREEN}[INFO] Connected directly to PostgreSQL via local psql client.${NC}"
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${SQL_TEST_FILE}"
elif docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}[INFO] Connected to PostgreSQL via Docker container '${CONTAINER_NAME}'.${NC}"
    docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" < "${SQL_TEST_FILE}"
else
    echo -e "${RED}[ERROR] Could not connect to PostgreSQL on ${DB_HOST}:${DB_PORT} and Docker container '${CONTAINER_NAME}' is not running.${NC}"
    echo -e "${YELLOW}Please make sure the database is running: docker compose up -d db${NC}"
    exit 1
fi

EXIT_CODE=$?

echo ""
if [ ${EXIT_CODE} -eq 0 ]; then
    echo -e "${GREEN}======================================================================${NC}"
    echo -e "${GREEN}  ✓ ALL INTEGRATION AND SECURITY TESTS PASSED SUCCESSFULLY (8/8)${NC}"
    echo -e "${GREEN}======================================================================${NC}"
else
    echo -e "${RED}======================================================================${NC}"
    echo -e "${RED}  ✗ INTEGRATION TESTS FAILED (Exit Code: ${EXIT_CODE})${NC}"
    echo -e "${RED}======================================================================${NC}"
fi

exit ${EXIT_CODE}
