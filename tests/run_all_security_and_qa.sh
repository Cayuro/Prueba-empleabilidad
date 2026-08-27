#!/bin/bash
set -e

# ==============================================================================
# RIWI CO. S.A.S. — MASTER QA, SECURITY & ADVERSARIAL VERIFICATION SUITE
# ==============================================================================

echo "=============================================================================="
echo "  STARTING COMPLETE END-TO-END QA & ADVERSARIAL SECURITY AUDIT"
echo "=============================================================================="

echo ""
echo ">>> STEP 1: RELOADING FRESH DATABASE SEED"
bash database/load-seed.sh

echo ""
echo ">>> STEP 2: RUNNING POSTGRESQL RLS INTEGRATION SUITE"
bash tests/integration/test_runner.sh

echo ""
echo ">>> STEP 3: RUNNING REST API END-TO-END SUITE"
bash tests/e2e_api_test.sh

echo ""
echo ">>> STEP 4: RUNNING ADVERSARIAL AI COPILOT & PROMPT INJECTION SUITE"
bash tests/adversarial_ai_test.sh

echo ""
echo ">>> STEP 5: RUNNING ADVERSARIAL BACKEND & AUTH SUITE"
bash tests/adversarial_backend_test.sh

echo ""
echo ">>> STEP 6: RUNNING ADVERSARIAL DATABASE RLS ENGINE SUITE"
docker exec -i rw_database psql -U postgres -d bd_juan_gomez_hamilton < tests/adversarial_rls_test.sql

echo ""
echo "=============================================================================="
echo "  ✓ COMPLETE SYSTEM AUDIT: ALL 5 SUITES PASSED WITH 100% SUCCESS!"
echo "=============================================================================="
