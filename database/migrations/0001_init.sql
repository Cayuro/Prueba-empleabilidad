-- =============================================================================
-- Migration 0001: Initial Schema, Security, Functions, Procedures and RLS
-- Riwi Co. S.A.S. — Internal Messaging Platform with AI
-- PostgreSQL 15+ (pgcrypto, vector, pg_trgm)
-- Paradigm: Smart Database (D-01 to D-15)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- 2. SCHEMAS & TABLES
-- =============================================================================

-- Table: rw_users
CREATE TABLE IF NOT EXISTS rw_users (
    rw_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rw_email          VARCHAR(255) NOT NULL,
    rw_password_hash  VARCHAR(255) NOT NULL,
    rw_name           VARCHAR(100) NOT NULL,
    rw_role           VARCHAR(50)  NOT NULL DEFAULT 'member'
                      CONSTRAINT chk_rw_users_role CHECK (rw_role IN ('admin', 'member')),
    rw_is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    rw_created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rw_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rw_deleted_at     TIMESTAMPTZ NULL,
    CONSTRAINT chk_rw_users_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
);

-- Table: rw_channels
CREATE TABLE IF NOT EXISTS rw_channels (
    rw_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rw_name           VARCHAR(100) NOT NULL,
    rw_is_private     BOOLEAN NOT NULL DEFAULT FALSE,
    rw_created_by     UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT,
    rw_is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    rw_created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rw_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rw_deleted_at     TIMESTAMPTZ NULL,
    CONSTRAINT chk_rw_channels_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
);

-- Table: rw_channel_members
CREATE TABLE IF NOT EXISTS rw_channel_members (
    rw_channel_id     UUID NOT NULL REFERENCES rw_channels(rw_id) ON DELETE RESTRICT,
    rw_user_id        UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT,
    rw_role           VARCHAR(50) NOT NULL DEFAULT 'member'
                      CONSTRAINT chk_rw_channel_members_role CHECK (rw_role IN ('admin', 'member')),
    rw_joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rw_is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    rw_deleted_at     TIMESTAMPTZ NULL,
    PRIMARY KEY (rw_channel_id, rw_user_id),
    CONSTRAINT chk_rw_channel_members_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
);

-- Table: rw_messages
CREATE TABLE IF NOT EXISTS rw_messages (
    rw_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rw_channel_id     UUID NOT NULL REFERENCES rw_channels(rw_id) ON DELETE RESTRICT,
    rw_author_id      UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT,
    rw_content        TEXT NOT NULL CONSTRAINT chk_rw_messages_content CHECK (TRIM(rw_content) <> ''),
    rw_metadata       JSONB NOT NULL DEFAULT '{}',
    rw_tsv            TSVECTOR NULL,
    rw_is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    rw_created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rw_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rw_deleted_at     TIMESTAMPTZ NULL,
    CONSTRAINT chk_rw_messages_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
);

-- Table: rw_message_reads
CREATE TABLE IF NOT EXISTS rw_message_reads (
    rw_message_id     UUID NOT NULL REFERENCES rw_messages(rw_id) ON DELETE RESTRICT,
    rw_user_id        UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT,
    rw_read_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rw_message_id, rw_user_id)
);

-- Table: rw_embeddings
CREATE TABLE IF NOT EXISTS rw_embeddings (
    rw_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rw_message_id     UUID NOT NULL REFERENCES rw_messages(rw_id) ON DELETE RESTRICT,
    rw_embedding      VECTOR(1536) NOT NULL,
    rw_created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: rw_refresh_tokens
CREATE TABLE IF NOT EXISTS rw_refresh_tokens (
    rw_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rw_user_id        UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT,
    rw_token_hash     VARCHAR(255) NOT NULL,
    rw_is_revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    rw_replaced_by    UUID NULL REFERENCES rw_refresh_tokens(rw_id) ON DELETE RESTRICT,
    rw_expires_at     TIMESTAMPTZ NOT NULL,
    rw_created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rw_revoked_at     TIMESTAMPTZ NULL
);

-- Table: rw_copilot_usage
CREATE TABLE IF NOT EXISTS rw_copilot_usage (
    rw_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rw_user_id        UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT,
    rw_query          TEXT NOT NULL CONSTRAINT chk_rw_copilot_usage_query CHECK (TRIM(rw_query) <> ''),
    rw_tokens_used    INT  NOT NULL CONSTRAINT chk_rw_copilot_usage_tokens CHECK (rw_tokens_used >= 0),
    rw_created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 3. INDEXES
-- =============================================================================

-- Partial unique index on active users (Case-insensitive via LOWER)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rw_users_email_active ON rw_users(LOWER(rw_email)) WHERE rw_is_active = TRUE;

-- Indexes on rw_channels
CREATE INDEX IF NOT EXISTS idx_rw_channels_created_by ON rw_channels(rw_created_by);
CREATE INDEX IF NOT EXISTS idx_rw_channels_active ON rw_channels(rw_is_active, rw_is_private);

-- Indexes on rw_channel_members
CREATE INDEX IF NOT EXISTS idx_rw_channel_members_user ON rw_channel_members(rw_user_id, rw_is_active);

-- Keyset pagination index on rw_messages (D-06)
CREATE INDEX IF NOT EXISTS idx_rw_messages_keyset ON rw_messages(rw_channel_id, rw_created_at DESC, rw_id DESC) WHERE rw_is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_rw_messages_author ON rw_messages(rw_author_id);

-- Full-Text search GIN index on rw_messages (D-10)
CREATE INDEX IF NOT EXISTS idx_rw_messages_tsv ON rw_messages USING GIN(rw_tsv);

-- Indexes on rw_message_reads
CREATE INDEX IF NOT EXISTS idx_rw_message_reads_user ON rw_message_reads(rw_user_id, rw_read_at);

-- Unique & similarity indexes on rw_embeddings
CREATE UNIQUE INDEX IF NOT EXISTS idx_rw_embeddings_message_id ON rw_embeddings(rw_message_id);
CREATE INDEX IF NOT EXISTS idx_rw_embeddings_vector_cosine ON rw_embeddings USING ivfflat (rw_embedding vector_cosine_ops) WITH (lists = 10);

-- Indexes on rw_refresh_tokens
CREATE INDEX IF NOT EXISTS idx_rw_refresh_tokens_hash ON rw_refresh_tokens(rw_token_hash) WHERE rw_is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_rw_refresh_tokens_user ON rw_refresh_tokens(rw_user_id);

-- Indexes on rw_copilot_usage
CREATE INDEX IF NOT EXISTS idx_rw_copilot_usage_user ON rw_copilot_usage(rw_user_id, rw_created_at DESC);

-- =============================================================================
-- 4. TRIGGERS & TRIGGER FUNCTIONS
-- =============================================================================

-- Trigger Function: Maintain updated_at timestamp (D-03)
CREATE OR REPLACE FUNCTION rw_fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.rw_updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rw_users_updated_at ON rw_users;
CREATE TRIGGER trg_rw_users_updated_at
    BEFORE UPDATE ON rw_users
    FOR EACH ROW EXECUTE FUNCTION rw_fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_rw_channels_updated_at ON rw_channels;
CREATE TRIGGER trg_rw_channels_updated_at
    BEFORE UPDATE ON rw_channels
    FOR EACH ROW EXECUTE FUNCTION rw_fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_rw_messages_updated_at ON rw_messages;
CREATE TRIGGER trg_rw_messages_updated_at
    BEFORE UPDATE ON rw_messages
    FOR EACH ROW EXECUTE FUNCTION rw_fn_set_updated_at();

-- Trigger Function: Prevent undeletion of soft-deleted records (D-01)
CREATE OR REPLACE FUNCTION rw_fn_prevent_undeletion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.rw_is_active = FALSE AND NEW.rw_is_active = TRUE THEN
        RAISE EXCEPTION 'Undeletion of inactive records is strictly prohibited (D-01)'
            USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.rw_deleted_at IS NOT NULL AND NEW.rw_deleted_at IS NULL THEN
        RAISE EXCEPTION 'Restoring deleted_at timestamp is strictly prohibited (D-01)'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rw_users_prevent_undeletion ON rw_users;
CREATE TRIGGER trg_rw_users_prevent_undeletion
    BEFORE UPDATE ON rw_users
    FOR EACH ROW EXECUTE FUNCTION rw_fn_prevent_undeletion();

DROP TRIGGER IF EXISTS trg_rw_channels_prevent_undeletion ON rw_channels;
CREATE TRIGGER trg_rw_channels_prevent_undeletion
    BEFORE UPDATE ON rw_channels
    FOR EACH ROW EXECUTE FUNCTION rw_fn_prevent_undeletion();

DROP TRIGGER IF EXISTS trg_rw_channel_members_prevent_undeletion ON rw_channel_members;
CREATE TRIGGER trg_rw_channel_members_prevent_undeletion
    BEFORE UPDATE ON rw_channel_members
    FOR EACH ROW EXECUTE FUNCTION rw_fn_prevent_undeletion();

DROP TRIGGER IF EXISTS trg_rw_messages_prevent_undeletion ON rw_messages;
CREATE TRIGGER trg_rw_messages_prevent_undeletion
    BEFORE UPDATE ON rw_messages
    FOR EACH ROW EXECUTE FUNCTION rw_fn_prevent_undeletion();

-- Trigger Function: Maintain full-text search vector (D-10)
CREATE OR REPLACE FUNCTION rw_fn_messages_tsv()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.rw_tsv = to_tsvector('spanish', COALESCE(NEW.rw_content, '')) || to_tsvector('english', COALESCE(NEW.rw_content, ''));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rw_messages_tsv ON rw_messages;
CREATE TRIGGER trg_rw_messages_tsv
    BEFORE INSERT OR UPDATE OF rw_content ON rw_messages
    FOR EACH ROW EXECUTE FUNCTION rw_fn_messages_tsv();

-- =============================================================================
-- 5. PROCEDURES & BUSINESS FUNCTIONS
-- =============================================================================

-- Helper Function: Check channel membership without RLS recursion
CREATE OR REPLACE FUNCTION rw_fn_is_channel_member(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM rw_channel_members
        WHERE rw_channel_id = p_channel_id
          AND rw_user_id = p_user_id
          AND rw_is_active = TRUE
    );
$$;

-- Helper Function: Check channel admin role without RLS recursion
CREATE OR REPLACE FUNCTION rw_fn_is_channel_admin(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM rw_channel_members
        WHERE rw_channel_id = p_channel_id
          AND rw_user_id = p_user_id
          AND rw_role = 'admin'
          AND rw_is_active = TRUE
    );
$$;

-- Helper Function: Check system-wide admin role without RLS recursion
CREATE OR REPLACE FUNCTION rw_fn_is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM rw_users
        WHERE rw_id = p_user_id
          AND rw_role = 'admin'
          AND rw_is_active = TRUE
    );
$$;

-- Helper Function: Set current user session context for RLS
CREATE OR REPLACE FUNCTION rw_fn_set_current_user(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
END;
$$;

-- Helper Function: Search authorized candidate messages strictly under SQL permissions (D-12)
CREATE OR REPLACE FUNCTION rw_fn_search_authorized_messages(p_candidate_ids UUID[])
RETURNS SETOF rw_messages LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
    RETURN QUERY
    SELECT m.*
    FROM rw_messages m
    JOIN rw_channels c ON m.rw_channel_id = c.rw_id
    WHERE m.rw_id = ANY(p_candidate_ids)
      AND m.rw_is_active = TRUE
      AND c.rw_is_active = TRUE
      AND (
          c.rw_is_private = FALSE
          OR c.rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR rw_fn_is_channel_member(c.rw_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
          OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
      )
    ORDER BY m.rw_created_at ASC;
END;
$$;

DROP FUNCTION IF EXISTS rw_fn_get_users(TEXT, INT);
CREATE OR REPLACE FUNCTION rw_fn_get_users(
    p_search TEXT DEFAULT '',
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    rw_id UUID,
    rw_email VARCHAR(255),
    rw_name VARCHAR(100),
    rw_role VARCHAR(50),
    rw_is_active BOOLEAN,
    rw_created_at TIMESTAMPTZ,
    rw_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_clean_limit INT;
BEGIN
    v_clean_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
    RETURN QUERY
        SELECT u.rw_id, u.rw_email, u.rw_name, u.rw_role, u.rw_is_active, u.rw_created_at, u.rw_updated_at
        FROM rw_users u
        WHERE u.rw_is_active = TRUE
          AND (
              p_search IS NULL
              OR p_search = ''
              OR u.rw_name ILIKE '%' || p_search || '%'
              OR u.rw_email ILIKE '%' || p_search || '%'
          )
        ORDER BY u.rw_name ASC
        LIMIT v_clean_limit;
END;
$$;

DROP PROCEDURE IF EXISTS rw_sp_get_users(TEXT, INT, REFCURSOR);
CREATE OR REPLACE PROCEDURE rw_sp_get_users(
    IN p_search TEXT,
    IN p_limit INT,
    INOUT p_result REFCURSOR DEFAULT 'users_cursor'
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_clean_limit INT;
BEGIN
    v_clean_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
    OPEN p_result FOR
        SELECT rw_id, rw_email, rw_name, rw_role, rw_is_active, rw_created_at
        FROM rw_users
        WHERE rw_is_active = TRUE
          AND (
              p_search IS NULL
              OR p_search = ''
              OR rw_name ILIKE '%' || p_search || '%'
              OR rw_email ILIKE '%' || p_search || '%'
          )
        ORDER BY rw_name ASC
        LIMIT v_clean_limit;
END;
$$;

DROP PROCEDURE IF EXISTS rw_sp_maintain_user(UUID, VARCHAR, VARCHAR, VARCHAR);
CREATE OR REPLACE PROCEDURE rw_sp_maintain_user(
    IN p_user_id UUID,
    IN p_name VARCHAR(100),
    IN p_role VARCHAR(50),
    IN p_action VARCHAR(20)
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF p_action = 'UPDATE' THEN
        UPDATE rw_users
        SET rw_name = COALESCE(p_name, rw_name),
            rw_role = COALESCE(p_role, rw_role),
            rw_updated_at = NOW()
        WHERE rw_id = p_user_id AND rw_is_active = TRUE;
    ELSIF p_action = 'DELETE' THEN
        UPDATE rw_users
        SET rw_is_active = FALSE,
            rw_deleted_at = NOW(),
            rw_updated_at = NOW()
        WHERE rw_id = p_user_id AND rw_is_active = TRUE;
    ELSE
        RAISE EXCEPTION 'Invalid action: % (Expected UPDATE or DELETE)', p_action
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
END;
$$;

DROP PROCEDURE IF EXISTS rw_sp_create_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID);
CREATE OR REPLACE PROCEDURE rw_sp_create_user(
    IN p_email VARCHAR(255),
    IN p_password_hash VARCHAR(255),
    IN p_name VARCHAR(100),
    IN p_role VARCHAR(50),
    INOUT p_user_id UUID DEFAULT NULL
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_clean_email VARCHAR(255);
    v_clean_role VARCHAR(50);
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    v_clean_role := COALESCE(p_role, 'member');

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RAISE EXCEPTION 'User email is required' USING ERRCODE = 'not_null_violation';
    END IF;

    IF EXISTS (SELECT 1 FROM rw_users WHERE LOWER(rw_email) = v_clean_email AND rw_is_active = TRUE) THEN
        RAISE EXCEPTION 'A user with email % already exists', v_clean_email USING ERRCODE = 'unique_violation';
    END IF;

    INSERT INTO rw_users (rw_email, rw_password_hash, rw_name, rw_role)
    VALUES (v_clean_email, p_password_hash, TRIM(p_name), v_clean_role)
    RETURNING rw_id INTO p_user_id;

    -- Automatically join active public channels
    INSERT INTO rw_channel_members (rw_channel_id, rw_user_id, rw_role)
    SELECT c.rw_id, p_user_id, 'member'
    FROM rw_channels c
    WHERE c.rw_is_private = FALSE AND c.rw_is_active = TRUE
    ON CONFLICT DO NOTHING;
END;
$$;

-- Function wrapper for SQL SELECT invocation of user creation
CREATE OR REPLACE FUNCTION rw_fn_create_user(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_name VARCHAR(100),
    p_role VARCHAR(50) DEFAULT 'member'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID;
BEGIN
    CALL rw_sp_create_user(p_email, p_password_hash, p_name, p_role, v_user_id);
    RETURN v_user_id;
END;
$$;

DROP PROCEDURE IF EXISTS rw_sp_issue_refresh_token(UUID, VARCHAR, TIMESTAMPTZ, UUID);
CREATE OR REPLACE PROCEDURE rw_sp_issue_refresh_token(
    IN p_user_id UUID,
    IN p_token_hash VARCHAR(255),
    IN p_expires_at TIMESTAMPTZ,
    INOUT p_token_id UUID DEFAULT NULL
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    INSERT INTO rw_refresh_tokens (rw_user_id, rw_token_hash, rw_expires_at)
    VALUES (p_user_id, p_token_hash, p_expires_at)
    RETURNING rw_id INTO p_token_id;
END;
$$;

DROP PROCEDURE IF EXISTS rw_sp_rotate_refresh_token(VARCHAR, VARCHAR, TIMESTAMPTZ, UUID, UUID);
CREATE OR REPLACE PROCEDURE rw_sp_rotate_refresh_token(
    IN p_old_token_hash VARCHAR(255),
    IN p_new_token_hash VARCHAR(255),
    IN p_new_expires_at TIMESTAMPTZ,
    INOUT p_user_id UUID DEFAULT NULL,
    INOUT p_new_token_id UUID DEFAULT NULL
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_old_token_id UUID;
    v_old_user_id UUID;
BEGIN
    SELECT rw_id, rw_user_id INTO v_old_token_id, v_old_user_id
    FROM rw_refresh_tokens
    WHERE rw_token_hash = p_old_token_hash
      AND rw_is_revoked = FALSE
      AND rw_expires_at > NOW();

    IF v_old_token_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired refresh token' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Insert replacement token
    INSERT INTO rw_refresh_tokens (rw_user_id, rw_token_hash, rw_expires_at)
    VALUES (v_old_user_id, p_new_token_hash, p_new_expires_at)
    RETURNING rw_id INTO p_new_token_id;

    -- Revoke old token and link to replacement
    UPDATE rw_refresh_tokens
    SET rw_is_revoked = TRUE,
        rw_revoked_at = NOW(),
        rw_replaced_by = p_new_token_id
    WHERE rw_id = v_old_token_id;

    p_user_id := v_old_user_id;
END;
$$;

-- Function wrapper for refresh token rotation
CREATE OR REPLACE FUNCTION rw_fn_rotate_refresh_token(
    p_old_token_hash VARCHAR(255),
    p_new_token_hash VARCHAR(255)
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_user_id UUID;
    v_new_token_id UUID;
BEGIN
    CALL rw_sp_rotate_refresh_token(p_old_token_hash, p_new_token_hash, NOW() + INTERVAL '30 days', v_user_id, v_new_token_id);
    RETURN v_user_id;
END;
$$;

-- Procedure & Function: Revoke refresh token
DROP PROCEDURE IF EXISTS rw_sp_revoke_refresh_token(VARCHAR);
CREATE OR REPLACE PROCEDURE rw_sp_revoke_refresh_token(
    IN p_token_hash VARCHAR(255)
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    UPDATE rw_refresh_tokens
    SET rw_is_revoked = TRUE,
        rw_revoked_at = NOW()
    WHERE rw_token_hash = p_token_hash;
END;
$$;

CREATE OR REPLACE FUNCTION rw_fn_revoke_refresh_token(
    p_token_hash VARCHAR(255)
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    CALL rw_sp_revoke_refresh_token(p_token_hash);
END;
$$;

-- =============================================================================
-- 6. VIEWS
-- =============================================================================

-- View: User conversations with last message and unread count under RLS
DROP VIEW IF EXISTS rw_vw_user_conversations CASCADE;
CREATE OR REPLACE VIEW rw_vw_user_conversations
WITH (security_invoker = true) AS
SELECT
    c.rw_id AS rw_channel_id,
    c.rw_name AS rw_channel_name,
    c.rw_is_private,
    c.rw_is_private AS rw_channel_is_private,
    c.rw_created_by AS rw_channel_created_by,
    c.rw_created_at AS rw_channel_created_at,
    c.rw_updated_at AS rw_channel_updated_at,
    COALESCE(cm.rw_role, 'member') AS rw_user_role,
    cm.rw_joined_at,
    (
        SELECT COUNT(*)
        FROM rw_channel_members sub_cm
        WHERE sub_cm.rw_channel_id = c.rw_id
          AND sub_cm.rw_is_active = TRUE
    ) AS rw_member_count,
    last_msg.rw_id AS rw_last_message_id,
    last_msg.rw_content AS rw_last_message_content,
    last_msg.rw_author_id AS rw_last_message_author_id,
    last_msg.rw_created_at AS rw_last_message_at,
    last_msg_author.rw_name AS rw_last_message_author,
    (
        SELECT COUNT(*)::INT
        FROM rw_messages unread_m
        WHERE unread_m.rw_channel_id = c.rw_id
          AND unread_m.rw_is_active = TRUE
          AND unread_m.rw_author_id <> NULLIF(current_setting('app.current_user_id', true), '')::uuid
          AND NOT EXISTS (
              SELECT 1 FROM rw_message_reads mr
              WHERE mr.rw_message_id = unread_m.rw_id
                AND mr.rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
    ) AS rw_unread_count
FROM rw_channels c
LEFT JOIN rw_channel_members cm
    ON cm.rw_channel_id = c.rw_id
   AND cm.rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
   AND cm.rw_is_active = TRUE
LEFT JOIN LATERAL (
    SELECT m.rw_id, m.rw_content, m.rw_created_at, m.rw_author_id
    FROM rw_messages m
    WHERE m.rw_channel_id = c.rw_id
      AND m.rw_is_active = TRUE
    ORDER BY m.rw_created_at DESC, m.rw_id DESC
    LIMIT 1
) last_msg ON TRUE
LEFT JOIN rw_users last_msg_author ON last_msg_author.rw_id = last_msg.rw_author_id
WHERE c.rw_is_active = TRUE
  AND (
      c.rw_is_private = FALSE
      OR cm.rw_user_id IS NOT NULL
      OR c.rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE rw_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_users           FORCE ROW LEVEL SECURITY;

ALTER TABLE rw_channels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_channels        FORCE ROW LEVEL SECURITY;

ALTER TABLE rw_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_channel_members FORCE ROW LEVEL SECURITY;

ALTER TABLE rw_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_messages        FORCE ROW LEVEL SECURITY;

ALTER TABLE rw_message_reads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_message_reads   FORCE ROW LEVEL SECURITY;

ALTER TABLE rw_refresh_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_refresh_tokens  FORCE ROW LEVEL SECURITY;

ALTER TABLE rw_copilot_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_copilot_usage   FORCE ROW LEVEL SECURITY;

-- Policies on rw_users
DROP POLICY IF EXISTS rw_users_select ON rw_users;
CREATE POLICY rw_users_select ON rw_users FOR SELECT
USING (rw_is_active = TRUE);

DROP POLICY IF EXISTS rw_users_update ON rw_users;
CREATE POLICY rw_users_update ON rw_users FOR UPDATE
USING (
    rw_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
);

-- Policies on rw_channels
DROP POLICY IF EXISTS rw_channels_select ON rw_channels;
CREATE POLICY rw_channels_select ON rw_channels FOR SELECT
USING (
    rw_is_active = TRUE
    AND (
        rw_is_private = FALSE
        OR rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR rw_fn_is_channel_member(rw_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
        OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    )
);

DROP POLICY IF EXISTS rw_channels_insert ON rw_channels;
CREATE POLICY rw_channels_insert ON rw_channels FOR INSERT
WITH CHECK (
    rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
);

DROP POLICY IF EXISTS rw_channels_update ON rw_channels;
CREATE POLICY rw_channels_update ON rw_channels FOR UPDATE
USING (
    rw_is_active = TRUE
    AND (
        rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR rw_fn_is_channel_admin(rw_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
        OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    )
);

-- Policies on rw_channel_members
DROP POLICY IF EXISTS rw_channel_members_select ON rw_channel_members;
CREATE POLICY rw_channel_members_select ON rw_channel_members FOR SELECT
USING (
    rw_is_active = TRUE
    AND (
        rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR rw_fn_is_channel_member(rw_channel_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
        OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    )
);

DROP POLICY IF EXISTS rw_channel_members_insert ON rw_channel_members;
CREATE POLICY rw_channel_members_insert ON rw_channel_members FOR INSERT
WITH CHECK (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR rw_fn_is_channel_admin(rw_channel_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR rw_fn_is_channel_member(rw_channel_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

DROP POLICY IF EXISTS rw_channel_members_update ON rw_channel_members;
CREATE POLICY rw_channel_members_update ON rw_channel_members FOR UPDATE
USING (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR rw_fn_is_channel_admin(rw_channel_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
);

-- Policies on rw_messages (Validates channel membership + app.current_user_id)
DROP POLICY IF EXISTS rw_messages_select ON rw_messages;
CREATE POLICY rw_messages_select ON rw_messages FOR SELECT
USING (
    (rw_is_active = TRUE OR rw_author_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    AND EXISTS (
        SELECT 1 FROM rw_channels c
        WHERE c.rw_id = rw_messages.rw_channel_id
          AND c.rw_is_active = TRUE
          AND (
              c.rw_is_private = FALSE
              OR c.rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              OR rw_fn_is_channel_member(c.rw_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
              OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
          )
    )
);

DROP POLICY IF EXISTS rw_messages_insert ON rw_messages;
CREATE POLICY rw_messages_insert ON rw_messages FOR INSERT
WITH CHECK (
    rw_author_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND EXISTS (
        SELECT 1 FROM rw_channels c
        WHERE c.rw_id = rw_messages.rw_channel_id
          AND c.rw_is_active = TRUE
          AND (
              c.rw_is_private = FALSE
              OR c.rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              OR rw_fn_is_channel_member(c.rw_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
              OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
          )
    )
);

DROP POLICY IF EXISTS rw_messages_update ON rw_messages;
CREATE POLICY rw_messages_update ON rw_messages FOR UPDATE
USING (
    rw_author_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
)
WITH CHECK (
    rw_author_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
);

-- Policies on rw_message_reads
DROP POLICY IF EXISTS rw_message_reads_select ON rw_message_reads;
CREATE POLICY rw_message_reads_select ON rw_message_reads FOR SELECT
USING (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR EXISTS (
        SELECT 1 FROM rw_messages m
        JOIN rw_channels c ON m.rw_channel_id = c.rw_id
        WHERE m.rw_id = rw_message_reads.rw_message_id
          AND (
              c.rw_is_private = FALSE
              OR c.rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              OR rw_fn_is_channel_member(c.rw_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
              OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
          )
    )
);

DROP POLICY IF EXISTS rw_message_reads_insert ON rw_message_reads;
CREATE POLICY rw_message_reads_insert ON rw_message_reads FOR INSERT
WITH CHECK (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND EXISTS (
        SELECT 1 FROM rw_messages m
        JOIN rw_channels c ON m.rw_channel_id = c.rw_id
        WHERE m.rw_id = rw_message_reads.rw_message_id
          AND m.rw_is_active = TRUE
          AND (
              c.rw_is_private = FALSE
              OR c.rw_created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              OR rw_fn_is_channel_member(c.rw_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
              OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
          )
    )
);

-- Policies on rw_copilot_usage
DROP POLICY IF EXISTS rw_copilot_usage_select ON rw_copilot_usage;
CREATE POLICY rw_copilot_usage_select ON rw_copilot_usage FOR SELECT
USING (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
);

DROP POLICY IF EXISTS rw_copilot_usage_insert ON rw_copilot_usage;
CREATE POLICY rw_copilot_usage_insert ON rw_copilot_usage FOR INSERT
WITH CHECK (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
);

-- Policies on rw_refresh_tokens (Scoped to calling user)
DROP POLICY IF EXISTS rw_refresh_tokens_select ON rw_refresh_tokens;
CREATE POLICY rw_refresh_tokens_select ON rw_refresh_tokens FOR SELECT
USING (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
);

DROP POLICY IF EXISTS rw_refresh_tokens_insert ON rw_refresh_tokens;
CREATE POLICY rw_refresh_tokens_insert ON rw_refresh_tokens FOR INSERT
WITH CHECK (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
);

DROP POLICY IF EXISTS rw_refresh_tokens_update ON rw_refresh_tokens;
CREATE POLICY rw_refresh_tokens_update ON rw_refresh_tokens FOR UPDATE
USING (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
)
WITH CHECK (
    rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
);

-- =============================================================================
-- 8. APPLICATION ROLE & LEAST PRIVILEGE GRANTS (D-09)
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rw_app') THEN
        CREATE ROLE rw_app WITH LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'rw_app_secure_pwd_2026!';
    ELSE
        ALTER ROLE rw_app WITH NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END $$;

-- Defense in depth: NO DELETE granted on ANY table
GRANT SELECT, UPDATE              ON rw_users                 TO rw_app;
GRANT SELECT, INSERT, UPDATE      ON rw_channels              TO rw_app;
GRANT SELECT, INSERT, UPDATE      ON rw_channel_members       TO rw_app;
GRANT SELECT, INSERT, UPDATE      ON rw_messages              TO rw_app;
GRANT SELECT, INSERT              ON rw_message_reads         TO rw_app;
GRANT SELECT, INSERT, UPDATE      ON rw_embeddings            TO rw_app;
GRANT SELECT, INSERT, UPDATE      ON rw_refresh_tokens        TO rw_app;
GRANT SELECT, INSERT              ON rw_copilot_usage         TO rw_app;
GRANT SELECT                      ON rw_vw_user_conversations TO rw_app;

-- Grant EXECUTE exclusively on necessary business functions and procedures
GRANT EXECUTE ON FUNCTION rw_fn_set_current_user(UUID) TO rw_app;
GRANT EXECUTE ON FUNCTION rw_fn_is_channel_member(UUID, UUID) TO rw_app;
GRANT EXECUTE ON FUNCTION rw_fn_is_channel_admin(UUID, UUID) TO rw_app;
GRANT EXECUTE ON FUNCTION rw_fn_is_admin(UUID) TO rw_app;
GRANT EXECUTE ON FUNCTION rw_fn_search_authorized_messages(UUID[]) TO rw_app;
GRANT EXECUTE ON FUNCTION rw_fn_get_users(TEXT, INT) TO rw_app;
GRANT EXECUTE ON FUNCTION rw_fn_create_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO rw_app;
GRANT EXECUTE ON FUNCTION rw_fn_rotate_refresh_token(VARCHAR, VARCHAR) TO rw_app;
GRANT EXECUTE ON FUNCTION rw_fn_revoke_refresh_token(VARCHAR) TO rw_app;
GRANT EXECUTE ON PROCEDURE rw_sp_get_users(TEXT, INT, REFCURSOR) TO rw_app;
GRANT EXECUTE ON PROCEDURE rw_sp_maintain_user(UUID, VARCHAR, VARCHAR, VARCHAR) TO rw_app;
GRANT EXECUTE ON PROCEDURE rw_sp_create_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID) TO rw_app;
GRANT EXECUTE ON PROCEDURE rw_sp_issue_refresh_token(UUID, VARCHAR, TIMESTAMPTZ, UUID) TO rw_app;
GRANT EXECUTE ON PROCEDURE rw_sp_rotate_refresh_token(VARCHAR, VARCHAR, TIMESTAMPTZ, UUID, UUID) TO rw_app;
GRANT EXECUTE ON PROCEDURE rw_sp_revoke_refresh_token(VARCHAR) TO rw_app;

REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM rw_app;

COMMIT;
