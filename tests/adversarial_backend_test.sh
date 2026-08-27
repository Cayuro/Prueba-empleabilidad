#!/bin/bash
set -e

# ==============================================================================
# RIWI CO. S.A.S. — ADVERSARIAL BACKEND & AUTHORIZATION TEST SUITE
# ==============================================================================

BASE_URL="http://localhost:8080"
PASS_COUNT=0
TOTAL_COUNT=0

echo "=============================================================================="
echo "  RUNNING ADVERSARIAL BACKEND, JWT & AUTHORIZATION TEST SUITE"
echo "=============================================================================="

# 1. Login Accounts
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@riwi.io","password":"RiwiAdmin2026!"}' | jq -r .access_token)
ESTEBAN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"esteban.qa@riwi.io","password":"RiwiDev2026!"}' | jq -r .access_token)
SANTIAGO_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"santiago.coder@riwi.io","password":"RiwiDev2026!"}' | jq -r .access_token)

# Test 1: Forged JWT signature
TOTAL_COUNT=$((TOTAL_COUNT + 1))
echo -n "[$TOTAL_COUNT] Security: Tampered JWT signature rejection ... "
FORGED_TOKEN="${ESTEBAN_TOKEN}TAMPERED_SIG"
FORGED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/conversations" -H "Authorization: Bearer $FORGED_TOKEN")
if [ "$FORGED_STATUS" -eq 401 ] || [ "$FORGED_STATUS" -eq 403 ]; then
  echo "PASSED (HTTP $FORGED_STATUS Unauthorized)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "FAILED (Received HTTP $FORGED_STATUS instead of 401)"
  exit 1
fi

# Test 2: Expired JWT token format rejection
TOTAL_COUNT=$((TOTAL_COUNT + 1))
echo -n "[$TOTAL_COUNT] Security: Malformed/Invalid Token rejection ... "
BAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/conversations" -H "Authorization: Bearer invalid.token.payload")
if [ "$BAD_STATUS" -eq 401 ] || [ "$BAD_STATUS" -eq 403 ]; then
  echo "PASSED (HTTP $BAD_STATUS Unauthorized)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "FAILED (Received HTTP $BAD_STATUS instead of 401)"
  exit 1
fi

# Test 3: Unauthorized private channel message access by non-member (Esteban on #liderazgo-estrategico)
TOTAL_COUNT=$((TOTAL_COUNT + 1))
echo -n "[$TOTAL_COUNT] RLS Isolation: Esteban reads private Leadership channel messages ... "
LEADERSHIP_MSGS=$(curl -s -X GET "$BASE_URL/api/channels/10000000-0000-0000-0000-000000000003/messages" -H "Authorization: Bearer $ESTEBAN_TOKEN")
MSGS_COUNT=$(echo "$LEADERSHIP_MSGS" | jq '. | length')
if [ "$MSGS_COUNT" -eq 0 ]; then
  echo "PASSED (0 messages returned via PostgreSQL RLS)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "FAILED (Data leak! Returned $MSGS_COUNT messages)"
  exit 1
fi

# Test 4: SQL Injection attempt in Search Query
TOTAL_COUNT=$((TOTAL_COUNT + 1))
echo -n "[$TOTAL_COUNT] SQL Injection Immunity: Parameterized query in search ... "
SQLI_RES=$(curl -s -X GET "$BASE_URL/api/messages/search?q=%27%20OR%201=1;%20--" -H "Authorization: Bearer $ESTEBAN_TOKEN")
if echo "$SQLI_RES" | jq . > /dev/null 2>&1; then
  echo "PASSED (Processed safely as plain text search without SQL syntax error)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "FAILED (SQL error occurred!)"
  exit 1
fi

# Test 5: Refresh token rotation with immediate revocation of previous token
TOTAL_COUNT=$((TOTAL_COUNT + 1))
echo -n "[$TOTAL_COUNT] Token Security: Refresh token single-use rotation ... "
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"esteban.qa@riwi.io","password":"RiwiDev2026!"}')
ORIG_REFRESH=$(echo "$LOGIN_RESP" | jq -r .refresh_token)

# First refresh (valid)
REFRESH_RESP_1=$(curl -s -X POST "$BASE_URL/api/auth/refresh" -H "Content-Type: application/json" -d "{\"refresh_token\":\"$ORIG_REFRESH\"}")
NEW_ACCESS=$(echo "$REFRESH_RESP_1" | jq -r .access_token)

# Second refresh with OLD token (must fail / revoked)
REUSE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/refresh" -H "Content-Type: application/json" -d "{\"refresh_token\":\"$ORIG_REFRESH\"}")
if [ "$REUSE_STATUS" -eq 401 ] && [ "$NEW_ACCESS" != "null" ]; then
  echo "PASSED (Old refresh token immediately revoked and rejected with 401)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "FAILED (Reused token was not revoked! HTTP $REUSE_STATUS)"
  exit 1
fi

echo "=============================================================================="
echo "  ✓ ALL $PASS_COUNT / $TOTAL_COUNT ADVERSARIAL BACKEND TESTS PASSED SUCCESSFULLY!"
echo "=============================================================================="
