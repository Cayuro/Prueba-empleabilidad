# Integration test: RLS

Test steps (to implement):
1. Spin up docker-compose
2. Create session as Bob (user 333...)
3. Attempt to read messages from `private-team` channel
4. Assert response is empty / forbidden

Also add test which uses vectorstore candidate for private message and assert DB filters it out before LLM call.
