# Contract Tests (manual spec)

These describe the contract tests to implement for CI. Use a contract testing framework or simple integration tests.

1) Auth flow
- POST /auth/login with valid credentials -> 200 with `access_token` and `refresh_token`
- POST /auth/refresh with valid refresh -> new tokens, old refresh invalid

2) Channels/messages
- GET /channels (with cursor) -> 200 and list
- GET /channels/{id}/messages -> returns only authorized messages (RLS enforced)
- POST /channels/{id}/messages -> 201 and message persisted with `deleted_at` null

3) Copilot contract
- POST /copilot/query -> with a query that matches messages
  - Assert backend calls VectorStore (mock) and DB filters unauthorized ids
  - Assert response JSON includes `answer`, `used_message_ids` and `citations`
  - Assert when DB returns empty authorized context, response is `422` or `200` with explicit 'Insufficient authorized context' message

4) Security negative tests
- Attempt to fetch private channel messages as non-member -> 403/empty
- VectorStore returns private id but DB filters it -> LLM mock never receives content
