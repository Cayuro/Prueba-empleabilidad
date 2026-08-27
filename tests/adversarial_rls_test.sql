-- ==============================================================================
-- RIWI CO. S.A.S. — ADVERSARIAL POSTGRESQL ROW LEVEL SECURITY (RLS) TEST SUITE
-- ==============================================================================

\set ON_ERROR_STOP on
SET client_min_messages TO warning;

DROP TABLE IF EXISTS _adversarial_results;
CREATE TEMP TABLE _adversarial_results (
    test_id INT,
    test_name TEXT,
    result TEXT,
    details TEXT
);

-- TEST 1: Unauthenticated Session (NULL app.current_user_id)
DO $$
DECLARE
    v_count INT;
BEGIN
    SET ROLE rw_app;
    RESET app.current_user_id;
    SELECT COUNT(*) INTO v_count FROM rw_channels WHERE rw_is_private = TRUE;
    RESET ROLE;
    IF v_count = 0 THEN
        INSERT INTO _adversarial_results VALUES (1, 'Unauthenticated Session Isolation', 'PASSED', 'Zero private channels visible when actor is not set.');
    ELSE
        INSERT INTO _adversarial_results VALUES (1, 'Unauthenticated Session Isolation', 'FAILED', 'Leaked ' || v_count || ' private channels to anonymous caller!');
    END IF;
END $$;

-- TEST 2: Non-Member Impersonation Attempt
DO $$
DECLARE
    v_count INT;
    v_esteban UUID := 'c0000000-0000-0000-0000-000000000007'; -- Non-member of leadership
    v_leadership UUID := '10000000-0000-0000-0000-000000000003';
BEGIN
    SET ROLE rw_app;
    PERFORM rw_fn_set_current_user(v_esteban);
    SELECT COUNT(*) INTO v_count FROM rw_messages WHERE rw_channel_id = v_leadership;
    RESET ROLE;
    IF v_count = 0 THEN
        INSERT INTO _adversarial_results VALUES (2, 'Non-Member Direct SQL Read Isolation', 'PASSED', 'Esteban receives 0 messages from #liderazgo-estrategico.');
    ELSE
        INSERT INTO _adversarial_results VALUES (2, 'Non-Member Direct SQL Read Isolation', 'FAILED', 'Esteban read ' || v_count || ' private messages!');
    END IF;
END $$;

-- TEST 3: Admin / Member Authorized Read
DO $$
DECLARE
    v_count INT;
    v_carlos UUID := 'c0000000-0000-0000-0000-000000000001'; -- Admin
    v_leadership UUID := '10000000-0000-0000-0000-000000000003';
BEGIN
    SET ROLE rw_app;
    PERFORM rw_fn_set_current_user(v_carlos);
    SELECT COUNT(*) INTO v_count FROM rw_messages WHERE rw_channel_id = v_leadership;
    RESET ROLE;
    IF v_count > 0 THEN
        INSERT INTO _adversarial_results VALUES (3, 'Authorized Member Read', 'PASSED', 'Carlos successfully read ' || v_count || ' authorized leadership messages.');
    ELSE
        INSERT INTO _adversarial_results VALUES (3, 'Authorized Member Read', 'FAILED', 'Carlos could not read authorized messages!');
    END IF;
END $$;

-- TEST 4: Physical DELETE Forbidden for rw_app role
DO $$
BEGIN
    SET ROLE rw_app;
    BEGIN
        DELETE FROM rw_messages WHERE rw_id = '20000000-0000-0000-0000-000000000001';
        RESET ROLE;
        INSERT INTO _adversarial_results VALUES (4, 'Physical DELETE Privilege Denial', 'FAILED', 'Physical DELETE succeeded under rw_app role!');
    EXCEPTION WHEN insufficient_privilege THEN
        RESET ROLE;
        INSERT INTO _adversarial_results VALUES (4, 'Physical DELETE Privilege Denial', 'PASSED', 'Physical DELETE raised permission denied under rw_app role as expected.');
    END;
END $$;

-- TEST 5: Soft Undeletion Blocked by Trigger
DO $$
DECLARE
    v_msg_id UUID := '20000000-0000-0000-0000-000000000001';
BEGIN
    -- Soft delete
    UPDATE rw_messages SET rw_is_active = FALSE, rw_deleted_at = NOW() WHERE rw_id = v_msg_id;

    -- Attempt to un-delete
    BEGIN
        UPDATE rw_messages SET rw_is_active = TRUE, rw_deleted_at = NULL WHERE rw_id = v_msg_id;
        INSERT INTO _adversarial_results VALUES (5, 'Soft Undeletion Immunity', 'FAILED', 'Undeletion succeeded without trigger error!');
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO _adversarial_results VALUES (5, 'Soft Undeletion Immunity', 'PASSED', 'Trigger trg_rw_messages_prevent_undeletion successfully blocked reactivation: ' || SQLERRM);
    END;

    -- Restore for subsequent tests
    -- (Done via superuser if needed, but table state remains valid)
END $$;

-- DISPLAY RESULTS TABLE
\echo '======================================================================'
\echo '  ADVERSARIAL POSTGRESQL RLS & INTEGRITY TEST RESULTS'
\echo '======================================================================'
SELECT test_id AS "#", test_name AS "Adversarial Security Test", result AS "Result", details AS "Assertion Evidence"
FROM _adversarial_results
ORDER BY test_id;
