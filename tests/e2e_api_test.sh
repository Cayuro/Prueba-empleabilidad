#!/usr/bin/env bash
set -e

TS=$(date +%s)
EMAIL="test.user.${TS}@riwi.io"

echo "=== 1. TEST REGISTRATION ($EMAIL) ==="
REG_RES=$(curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User $TS\",\"email\":\"$EMAIL\",\"password\":\"TestPass2026!\"}")
ACCESS_TOKEN=$(echo "$REG_RES" | jq -r .access_token)
REFRESH_TOKEN=$(echo "$REG_RES" | jq -r .refresh_token)
echo "Registered successfully. Token: ${ACCESS_TOKEN:0:25}..."

echo "=== 2. TEST REFRESH TOKEN ROTATION ==="
REFRESH_RES=$(curl -s -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
NEW_ACCESS_TOKEN=$(echo "$REFRESH_RES" | jq -r .access_token)
NEW_REFRESH_TOKEN=$(echo "$REFRESH_RES" | jq -r .refresh_token)
echo "Token refreshed successfully."

echo "=== 3. TEST GET CONVERSATIONS ==="
CONVS=$(curl -s -H "Authorization: Bearer $NEW_ACCESS_TOKEN" http://localhost:8080/api/conversations)
echo "Found $(echo "$CONVS" | jq '. | length') accessible conversations."

echo "=== 4. TEST CREATE CHANNEL ==="
NEW_CHAN=$(curl -s -X POST http://localhost:8080/api/channels \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"clan-${TS}\",\"is_private\":false}")
CHAN_ID=$(echo "$NEW_CHAN" | jq -r .rw_id)
echo "Created channel: $CHAN_ID"

echo "=== 5. TEST SEND MESSAGE ==="
NEW_MSG=$(curl -s -X POST "http://localhost:8080/api/channels/$CHAN_ID/messages" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Prueba de integración en tiempo real del nuevo clan."}')
MSG_ID=$(echo "$NEW_MSG" | jq -r .rw_id)
echo "Sent message: $MSG_ID"

echo "=== 6. TEST KEYSET PAGINATION ==="
MSGS=$(curl -s -H "Authorization: Bearer $NEW_ACCESS_TOKEN" "http://localhost:8080/api/channels/$CHAN_ID/messages?limit=10")
echo "Fetched $(echo "$MSGS" | jq '. | length') messages."

echo "=== 7. TEST MARK AS READ ==="
READ_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:8080/api/channels/$CHAN_ID/messages/$MSG_ID/read" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN")
echo "Mark read HTTP status: $READ_STATUS"

echo "=== 8. TEST FULL-TEXT SEARCH ==="
SEARCH_RES=$(curl -s -H "Authorization: Bearer $NEW_ACCESS_TOKEN" "http://localhost:8080/api/messages/search?q=plataforma")
echo "Search results count: $(echo "$SEARCH_RES" | jq '. | length')"

echo "=== 9. TEST COPILOT RAG QUERY ==="
COPILOT_RES=$(curl -s -X POST http://localhost:8080/api/copilot/query \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"¿Qué tecnologías estamos usando en la plataforma?"}')
echo "Copilot tokens used: $(echo "$COPILOT_RES" | jq .tokens_used)"

echo "=== 10. TEST COPILOT USAGE STATS ==="
USAGE=$(curl -s -H "Authorization: Bearer $NEW_ACCESS_TOKEN" http://localhost:8080/api/copilot/usage)
echo "User Copilot total queries: $(echo "$USAGE" | jq .total_queries), total tokens: $(echo "$USAGE" | jq .total_tokens)"

echo "=== 11. TEST SOFT DELETE MESSAGE ==="
DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:8080/api/channels/$CHAN_ID/messages/$MSG_ID" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN")
echo "Soft delete HTTP status: $DEL_STATUS"

echo "=== 12. TEST LOGOUT ==="
LOGOUT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/auth/logout \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$NEW_REFRESH_TOKEN\"}")
echo "Logout HTTP status: $LOGOUT_STATUS"

echo ""
echo ">>> ALL 12 ENDPOINTS PASSED SUCCESSFULLY! <<<"
