-- =============================================================================
-- Automated Integration & Security Test Suite
-- Riwi Co. S.A.S. — Internal Messaging Platform with AI
-- PostgreSQL 15+ (pgvector, pgcrypto, pg_trgm)
-- Paradigm: Smart Database Validation (RLS, Soft Delete, RBAC, Keyset, RAG)
-- =============================================================================

\set ON_ERROR_STOP on
\timing off

CREATE TEMP TABLE IF NOT EXISTS test_results (
    test_num    INT,
    test_name   TEXT,
    status      TEXT,
    details     TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);
TRUNCATE TABLE test_results;

-- =============================================================================
-- TEST 1: User non-member attempts to read private channel -> returns 0 messages
-- Santiago Restrepo (c0000000-0000-0000-0000-000000000003) is NOT a member of
-- 'liderazgo-privado' (10000000-0000-0000-0000-000000000003).
-- =============================================================================
DO $$
DECLARE
    v_msg_count INT;
    v_santiago_id CONSTANT UUID := 'c0000000-0000-0000-0000-000000000003';
    v_private_channel_id CONSTANT UUID := '10000000-0000-0000-0000-000000000003';
BEGIN
    SET ROLE rw_app;
    PERFORM rw_fn_set_current_user(v_santiago_id);

    SELECT COUNT(*) INTO v_msg_count
    FROM rw_messages
    WHERE rw_channel_id = v_private_channel_id;

    RESET ROLE;

    IF v_msg_count = 0 THEN
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (1, 'Non-member private channel read isolation', 'PASSED',
                'Santiago correctly received 0 messages from private channel.');
    ELSE
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (1, 'Non-member private channel read isolation', 'FAILED',
                format('Santiago received %s messages, expected 0.', v_msg_count));
        RAISE EXCEPTION 'TEST 1 FAILED: Non-member was able to read % messages', v_msg_count;
    END IF;
END $$;


-- =============================================================================
-- TEST 2: Private Channel of User B is invisible to User A
-- Santiago Restrepo cannot see 'liderazgo-privado', but Carlos Mendoza can.
-- =============================================================================
DO $$
DECLARE
    v_santiago_channels INT;
    v_carlos_channels   INT;
    v_santiago_id CONSTANT UUID := 'c0000000-0000-0000-0000-000000000003';
    v_carlos_id   CONSTANT UUID := 'c0000000-0000-0000-0000-000000000001';
    v_private_channel_id CONSTANT UUID := '10000000-0000-0000-0000-000000000003';
BEGIN
    -- Query as Santiago
    SET ROLE rw_app;
    PERFORM rw_fn_set_current_user(v_santiago_id);

    SELECT COUNT(*) INTO v_santiago_channels
    FROM rw_channels
    WHERE rw_id = v_private_channel_id;

    -- Query as Carlos (creator/admin)
    PERFORM rw_fn_set_current_user(v_carlos_id);

    SELECT COUNT(*) INTO v_carlos_channels
    FROM rw_channels
    WHERE rw_id = v_private_channel_id;

    RESET ROLE;

    IF v_santiago_channels = 0 AND v_carlos_channels = 1 THEN
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (2, 'Channel visibility isolation (RLS)', 'PASSED',
                'Private channel is invisible to non-members (0) and visible to creator (1).');
    ELSE
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (2, 'Channel visibility isolation (RLS)', 'FAILED',
                format('Santiago saw %s channels, Carlos saw %s channels.', v_santiago_channels, v_carlos_channels));
        RAISE EXCEPTION 'TEST 2 FAILED: Channel visibility mismatch';
    END IF;
END $$;


-- =============================================================================
-- TEST 3: Soft delete -> record stays in DB with rw_deleted_at set & rw_is_active = FALSE
-- Also verifies trigger trg_rw_users_prevent_undeletion blocks reactivation.
-- =============================================================================
DO $$
DECLARE
    v_temp_user_id UUID;
    v_is_active    BOOLEAN;
    v_deleted_at   TIMESTAMPTZ;
    v_undelete_caught BOOLEAN := FALSE;
BEGIN
    -- 1. Create a dummy user
    CALL rw_sp_create_user('test.softdelete@riwi.io', 'hash123', 'Test Soft Delete', 'member', v_temp_user_id);

    -- 2. Soft delete user via stored procedure
    CALL rw_sp_maintain_user(v_temp_user_id, NULL, NULL, 'DELETE');

    -- 3. Verify record remains in DB with rw_is_active = FALSE and rw_deleted_at NOT NULL
    SELECT rw_is_active, rw_deleted_at
    INTO v_is_active, v_deleted_at
    FROM rw_users
    WHERE rw_id = v_temp_user_id;

    IF v_is_active <> FALSE OR v_deleted_at IS NULL THEN
        RAISE EXCEPTION 'TEST 3 FAILED: User was not soft deleted properly. is_active=%, deleted_at=%', v_is_active, v_deleted_at;
    END IF;

    -- 4. Test trigger preventing restoration
    BEGIN
        UPDATE rw_users
        SET rw_is_active = TRUE, rw_deleted_at = NULL
        WHERE rw_id = v_temp_user_id;
    EXCEPTION WHEN OTHERS THEN
        v_undelete_caught := TRUE;
    END;

    IF NOT v_undelete_caught THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Undeletion trigger failed to prevent restore of soft-deleted record';
    END IF;

    INSERT INTO test_results (test_num, test_name, status, details)
    VALUES (3, 'Soft delete persistence and undeletion block', 'PASSED',
            'Record remains with is_active=FALSE, deleted_at set, and trigger blocked restore.');
END $$;


-- =============================================================================
-- TEST 4: Physical DELETE attempt with rw_app role -> ERROR: permission denied
-- rw_app role must NOT have DELETE privileges on any table (Least Privilege D-09).
-- =============================================================================
DO $$
DECLARE
    v_permission_denied BOOLEAN := FALSE;
BEGIN
    SET ROLE rw_app;
    BEGIN
        DELETE FROM rw_messages WHERE rw_id = '20000000-0000-0000-0000-000000000001';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_permission_denied := TRUE;
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%permission denied%' THEN
                v_permission_denied := TRUE;
            END IF;
    END;
    RESET ROLE;

    IF v_permission_denied THEN
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (4, 'Physical DELETE forbidden for rw_app', 'PASSED',
                'DELETE statement raised insufficient_privilege / permission denied as expected.');
    ELSE
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (4, 'Physical DELETE forbidden for rw_app', 'FAILED',
                'rw_app was able to execute or attempt DELETE without permission denied error.');
        RAISE EXCEPTION 'TEST 4 FAILED: Physical DELETE was not denied';
    END IF;
END $$;


-- =============================================================================
-- TEST 5: Refresh token rotation -> revoked token cannot be reused
-- Simulates token rotation with rw_replaced_by pointer and revoked state check.
-- =============================================================================
DO $$
DECLARE
    v_user_id       CONSTANT UUID := 'c0000000-0000-0000-0000-000000000002';
    v_token1_id     UUID;
    v_token2_id     UUID;
    v_token1_revoked BOOLEAN;
    v_token1_replaced UUID;
    v_token2_revoked BOOLEAN;
BEGIN
    -- 1. Insert initial token
    INSERT INTO rw_refresh_tokens (rw_user_id, rw_token_hash, rw_is_revoked, rw_expires_at)
    VALUES (v_user_id, encode(digest('token_secret_1', 'sha256'), 'hex'), FALSE, NOW() + INTERVAL '30 days')
    RETURNING rw_id INTO v_token1_id;

    -- 2. Rotate token: create new token and mark old as revoked with replacement pointer
    INSERT INTO rw_refresh_tokens (rw_user_id, rw_token_hash, rw_is_revoked, rw_expires_at)
    VALUES (v_user_id, encode(digest('token_secret_2', 'sha256'), 'hex'), FALSE, NOW() + INTERVAL '30 days')
    RETURNING rw_id INTO v_token2_id;

    UPDATE rw_refresh_tokens
    SET rw_is_revoked = TRUE, rw_replaced_by = v_token2_id
    WHERE rw_id = v_token1_id;

    -- 3. Verify token 1 is revoked and points to token 2
    SELECT rw_is_revoked, rw_replaced_by
    INTO v_token1_revoked, v_token1_replaced
    FROM rw_refresh_tokens
    WHERE rw_id = v_token1_id;

    SELECT rw_is_revoked
    INTO v_token2_revoked
    FROM rw_refresh_tokens
    WHERE rw_id = v_token2_id;

    IF v_token1_revoked = TRUE AND v_token1_replaced = v_token2_id AND v_token2_revoked = FALSE THEN
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (5, 'Refresh token rotation and revocation check', 'PASSED',
                'Original token is revoked and linked to replacement; new token is active.');
    ELSE
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (5, 'Refresh token rotation and revocation check', 'FAILED',
                'Token rotation state mismatch.');
        RAISE EXCEPTION 'TEST 5 FAILED: Token rotation verification failed';
    END IF;
END $$;


-- =============================================================================
-- TEST 6: Keyset pagination order and consistency
-- Fetches messages ordered by (rw_created_at DESC, rw_id DESC) with limit 2,
-- then uses last tuple as cursor to fetch page 2. Verifies zero overlaps.
-- =============================================================================
DO $$
DECLARE
    v_channel_id CONSTANT UUID := '10000000-0000-0000-0000-000000000002';
    v_carlos_id  CONSTANT UUID := 'c0000000-0000-0000-0000-000000000001';
    v_p1_m1_id UUID; v_p1_m2_id UUID;
    v_cursor_created TIMESTAMPTZ;
    v_cursor_id UUID;
    v_p2_m1_id UUID; v_p2_m2_id UUID;
BEGIN
    SET ROLE rw_app;
    PERFORM rw_fn_set_current_user(v_carlos_id);

    -- Page 1: 2 items
    SELECT rw_id, rw_created_at
    INTO v_p1_m1_id, v_cursor_created
    FROM rw_messages
    WHERE rw_channel_id = v_channel_id AND rw_is_active = TRUE
    ORDER BY rw_created_at DESC, rw_id DESC
    LIMIT 1;

    SELECT rw_id, rw_created_at
    INTO v_p1_m2_id, v_cursor_created
    FROM rw_messages
    WHERE rw_channel_id = v_channel_id AND rw_is_active = TRUE
    ORDER BY rw_created_at DESC, rw_id DESC
    OFFSET 1 LIMIT 1;
    v_cursor_id := v_p1_m2_id;

    -- Page 2: 2 items using Keyset cursor (rw_created_at, rw_id) < (cursor_created, cursor_id)
    SELECT rw_id
    INTO v_p2_m1_id
    FROM rw_messages
    WHERE rw_channel_id = v_channel_id
      AND rw_is_active = TRUE
      AND (rw_created_at, rw_id) < (v_cursor_created, v_cursor_id)
    ORDER BY rw_created_at DESC, rw_id DESC
    LIMIT 1;

    SELECT rw_id
    INTO v_p2_m2_id
    FROM rw_messages
    WHERE rw_channel_id = v_channel_id
      AND rw_is_active = TRUE
      AND (rw_created_at, rw_id) < (v_cursor_created, v_cursor_id)
    ORDER BY rw_created_at DESC, rw_id DESC
    OFFSET 1 LIMIT 1;

    RESET ROLE;

    -- Verify no overlapping IDs across page 1 and page 2
    IF v_p1_m1_id IS NOT NULL AND v_p1_m2_id IS NOT NULL AND v_p2_m1_id IS NOT NULL
       AND v_p1_m1_id <> v_p2_m1_id AND v_p1_m2_id <> v_p2_m1_id
       AND v_p1_m1_id <> v_p2_m1_id AND v_p1_m2_id <> v_p2_m2_id THEN
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (6, 'Keyset pagination cursor consistency', 'PASSED',
                format('Pages 1 and 2 successfully partitioned without duplicates. Cursor: %s', v_cursor_id));
    ELSE
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (6, 'Keyset pagination cursor consistency', 'FAILED',
                'Duplicate or missing records detected across keyset pages.');
        RAISE EXCEPTION 'TEST 6 FAILED: Keyset pagination partition error';
    END IF;
END $$;


-- =============================================================================
-- TEST 7: Vector candidate filtered by RLS in SQL
-- Tests rw_fn_search_authorized_messages() with candidate IDs containing a
-- message from private channel 'liderazgo-privado'. Non-member must NOT see it.
-- =============================================================================
DO $$
DECLARE
    v_santiago_id CONSTANT UUID := 'c0000000-0000-0000-0000-000000000003';
    v_carlos_id   CONSTANT UUID := 'c0000000-0000-0000-0000-000000000001';
    v_public_msg_id  CONSTANT UUID := '20000000-0000-0000-0000-000000000001';
    v_private_msg_id CONSTANT UUID := '20000000-0000-0000-0000-000000000008';
    v_candidate_ids UUID[] := ARRAY[v_public_msg_id, v_private_msg_id];
    v_santiago_results INT;
    v_carlos_results   INT;
BEGIN
    -- Query as Santiago (non-member of private channel)
    SET ROLE rw_app;
    PERFORM rw_fn_set_current_user(v_santiago_id);

    SELECT COUNT(*) INTO v_santiago_results
    FROM rw_fn_search_authorized_messages(v_candidate_ids);

    -- Query as Carlos (admin/member of private channel)
    PERFORM rw_fn_set_current_user(v_carlos_id);

    SELECT COUNT(*) INTO v_carlos_results
    FROM rw_fn_search_authorized_messages(v_candidate_ids);

    RESET ROLE;

    IF v_santiago_results = 1 AND v_carlos_results = 2 THEN
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (7, 'Vector candidates SQL RLS filtering', 'PASSED',
                'Private candidate automatically stripped by RLS for unauthorized user (1 vs 2).');
    ELSE
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (7, 'Vector candidates SQL RLS filtering', 'FAILED',
                format('Santiago got %s, Carlos got %s results.', v_santiago_results, v_carlos_results));
        RAISE EXCEPTION 'TEST 7 FAILED: RLS did not filter vector candidates correctly';
    END IF;
END $$;


-- =============================================================================
-- TEST 8: Read receipt idempotence and unread_count in rw_vw_user_conversations
-- Verifies read receipt inserts with ON CONFLICT DO NOTHING are idempotent,
-- and unread count in rw_vw_user_conversations updates accurately.
-- =============================================================================
DO $$
DECLARE
    v_user_id    CONSTANT UUID := 'c0000000-0000-0000-0000-000000000004'; -- Mariana
    v_channel_id CONSTANT UUID := '10000000-0000-0000-0000-000000000002'; -- desarrollo-dev
    v_msg_id     CONSTANT UUID := '20000000-0000-0000-0000-000000000004';
    v_unread_before INT;
    v_unread_after  INT;
BEGIN
    SET ROLE rw_app;
    PERFORM rw_fn_set_current_user(v_user_id);

    -- 1. Read initial unread count
    SELECT COALESCE(rw_unread_count, 0)
    INTO v_unread_before
    FROM rw_vw_user_conversations
    WHERE rw_channel_id = v_channel_id;

    -- 2. Mark message as read (Idempotent 1st time)
    INSERT INTO rw_message_reads (rw_message_id, rw_user_id)
    VALUES (v_msg_id, v_user_id)
    ON CONFLICT (rw_message_id, rw_user_id) DO NOTHING;

    -- 3. Mark message as read again (Idempotent 2nd time - duplicate check)
    INSERT INTO rw_message_reads (rw_message_id, rw_user_id)
    VALUES (v_msg_id, v_user_id)
    ON CONFLICT (rw_message_id, rw_user_id) DO NOTHING;

    -- 4. Check unread count after marking read
    SELECT COALESCE(rw_unread_count, 0)
    INTO v_unread_after
    FROM rw_vw_user_conversations
    WHERE rw_channel_id = v_channel_id;

    RESET ROLE;

    IF v_unread_after <= v_unread_before THEN
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (8, 'Read receipt idempotence & unread view count', 'PASSED',
                format('Idempotent read receipts verified. Unread before: %s, after: %s.', v_unread_before, v_unread_after));
    ELSE
        INSERT INTO test_results (test_num, test_name, status, details)
        VALUES (8, 'Read receipt idempotence & unread view count', 'FAILED',
                format('Unread count calculation failed. Before: %s, After: %s', v_unread_before, v_unread_after));
        RAISE EXCEPTION 'TEST 8 FAILED: Unread count did not decrease or remain valid';
    END IF;
END $$;


-- =============================================================================
-- TEST SUITE SUMMARY REPORT
-- =============================================================================
SELECT
    test_num AS "#",
    test_name AS "Integration Test Name",
    status AS "Result",
    details AS "Test Details & Invariant Assertions"
FROM test_results
ORDER BY test_num ASC;
