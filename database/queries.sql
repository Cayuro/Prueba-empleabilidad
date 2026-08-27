-- ============================================================================
-- Riwi Messaging Platform - Consultas SQL Requeridas (Sección 11)
-- ============================================================================

-- CONTEXTO DE SESIÓN OBLIGATORIO:
-- Fijar el actor autenticado para respetar Row Level Security (RLS):
SELECT rw_fn_set_current_user('c0000000-0000-0000-0000-000000000002'); -- Valeria Gomez (member)

-- ----------------------------------------------------------------------------
-- Consulta 1: Historial de mensajes de un canal con paginación por keyset (D-06)
-- ----------------------------------------------------------------------------
-- Obtiene los mensajes ordenados cronológicamente inverso sin usar OFFSET.
-- El cursor combina la marca de tiempo (rw_created_at) y el identificador único (rw_id).

SELECT 
    m.rw_id,
    m.rw_channel_id,
    m.rw_author_id,
    u.rw_name AS rw_author_name,
    m.rw_content,
    m.rw_metadata,
    m.rw_created_at,
    m.rw_updated_at
FROM rw_messages m
JOIN rw_users u ON m.rw_author_id = u.rw_id
WHERE m.rw_channel_id = '10000000-0000-0000-0000-000000000001' -- Canal #general
  AND m.rw_is_active = TRUE
ORDER BY m.rw_created_at DESC, m.rw_id DESC
LIMIT 20;


-- ----------------------------------------------------------------------------
-- Consulta 2: Búsqueda de mensajes con resaltado del término encontrado (D-10)
-- ----------------------------------------------------------------------------
-- Utiliza el vector de búsqueda rw_tsv generado automáticamente por trigger
-- y ts_headline para resaltar los términos coincidentes con etiquetas HTML.

SELECT 
    m.rw_id,
    m.rw_channel_id,
    c.rw_name AS rw_channel_name,
    u.rw_name AS rw_author_name,
    ts_headline('spanish', m.rw_content, plainto_tsquery('spanish', 'plataforma'), 
                'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15') AS rw_highlighted_content,
    m.rw_created_at
FROM rw_messages m
JOIN rw_channels c ON m.rw_channel_id = c.rw_id
JOIN rw_users u ON m.rw_author_id = u.rw_id
WHERE m.rw_tsv @@ (plainto_tsquery('spanish', 'plataforma') || plainto_tsquery('english', 'plataforma'))
  AND m.rw_is_active = TRUE
ORDER BY m.rw_created_at DESC;


-- ----------------------------------------------------------------------------
-- Consulta 3: Recuperación de contexto para el copiloto con permisos en SQL (D-12)
-- ----------------------------------------------------------------------------
-- Dado un conjunto de UUIDs candidatos recuperados por búsqueda vectorial,
-- la base de datos filtra y retorna exclusivamente los mensajes pertenecientes
-- a canales donde el usuario autenticado tiene membresía activa o que son públicos.

SELECT * 
FROM rw_fn_search_authorized_messages(
    ARRAY[
        '20000000-0000-0000-0000-000000000001'::uuid, -- Mensaje en canal público #general
        '20000000-0000-0000-0000-000000000004'::uuid, -- Mensaje en canal dev
        '20000000-0000-0000-0000-000000000008'::uuid  -- Mensaje en canal liderazgo
    ]
);


-- ----------------------------------------------------------------------------
-- Consulta 4: Consumo acumulado del copiloto por usuario (D-09)
-- ----------------------------------------------------------------------------
-- Calcula el total de consultas realizadas, la suma acumulada de tokens consumidos
-- y la marca de tiempo de la última consulta para el usuario en sesión.

SELECT 
    rw_user_id,
    COUNT(rw_id) AS total_queries,
    COALESCE(SUM(rw_tokens_used), 0) AS total_tokens_used,
    MAX(rw_created_at) AS last_query_at
FROM rw_copilot_usage
WHERE rw_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
GROUP BY rw_user_id;
