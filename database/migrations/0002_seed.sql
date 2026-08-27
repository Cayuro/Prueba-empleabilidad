-- =============================================================================
-- Migration 0002: Seed initial corpus and 10 demo users
-- Executed automatically on fresh database container initialization
-- Riwi Co. S.A.S. — Internal Messaging Platform with AI
-- =============================================================================

BEGIN;

-- 1. Insert 10 Users
INSERT INTO rw_users (rw_id, rw_email, rw_password_hash, rw_name, rw_role, rw_is_active, rw_created_at, rw_updated_at, rw_deleted_at)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'admin@riwi.io', '$2a$10$xEz41CbtGbHKT6dV1pxiq.vsZMWk1IQZ/5P/CUwBmliqQobeu1JAy', 'Carlos Mendoza', 'admin', TRUE, '2026-08-01 08:00:00+00', '2026-08-01 08:00:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000002', 'valeria.dev@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Valeria Gomez', 'member', TRUE, '2026-08-01 08:30:00+00', '2026-08-01 08:30:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000003', 'santiago.coder@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Santiago Restrepo', 'member', TRUE, '2026-08-01 09:00:00+00', '2026-08-01 09:00:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000004', 'mariana.ai@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Mariana Torres', 'member', TRUE, '2026-08-01 09:30:00+00', '2026-08-01 09:30:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000005', 'alejandro.lead@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Alejandro Castro', 'admin', TRUE, '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000006', 'esteban.qa@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Esteban Morales', 'member', TRUE, '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000007', 'camila.ux@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Camila Vargas', 'member', TRUE, '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000008', 'mateo.backend@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Mateo Rueda', 'member', TRUE, '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000009', 'lucia.cloud@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Lucia Herrera', 'member', TRUE, '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00', NULL),
    ('c0000000-0000-0000-0000-000000000010', 'diego.coder@riwi.io', '$2a$10$8vagG7KWtRUqDTQVeVhcJ.RYiXlim6gxBNL9M6BbwGMRS72McU2WG', 'Diego Ospina', 'member', TRUE, '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00', NULL)
ON CONFLICT (rw_id) DO NOTHING;

-- 2. Insert Channels (Public and Private with descriptive names)
INSERT INTO rw_channels (rw_id, rw_name, rw_is_private, rw_created_by, rw_is_active, rw_created_at, rw_updated_at, rw_deleted_at)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'general-anuncios', FALSE, 'c0000000-0000-0000-0000-000000000001', TRUE, '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00', NULL),
    ('10000000-0000-0000-0000-000000000002', 'reuniones-despliegue-y-dev', FALSE, 'c0000000-0000-0000-0000-000000000002', TRUE, '2026-08-01 10:15:00+00', '2026-08-01 10:15:00+00', NULL),
    ('10000000-0000-0000-0000-000000000003', 'liderazgo-estrategico', TRUE, 'c0000000-0000-0000-0000-000000000001', TRUE, '2026-08-01 10:30:00+00', '2026-08-01 10:30:00+00', NULL),
    ('10000000-0000-0000-0000-000000000004', 'proyecto-frontend-ui', TRUE, 'c0000000-0000-0000-0000-000000000002', TRUE, '2026-08-01 10:45:00+00', '2026-08-01 10:45:00+00', NULL)
ON CONFLICT (rw_id) DO NOTHING;

-- 3. Insert Channel Members
INSERT INTO rw_channel_members (rw_channel_id, rw_user_id, rw_role, rw_joined_at, rw_is_active, rw_deleted_at)
VALUES
    -- General Channel Members (All 10 users auto-join)
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'admin', '2026-08-01 10:00:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'member', '2026-08-01 10:05:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'member', '2026-08-01 10:05:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'member', '2026-08-01 10:05:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'admin', '2026-08-01 10:05:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'member', '2026-08-01 10:05:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'member', '2026-08-01 10:05:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'member', '2026-08-01 10:05:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'member', '2026-08-01 10:05:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'member', '2026-08-01 10:05:00+00', TRUE, NULL),
    -- Dev Channel Members (Public)
    ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'member', '2026-08-01 10:15:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'admin', '2026-08-01 10:15:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'member', '2026-08-01 10:15:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'member', '2026-08-01 10:15:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006', 'member', '2026-08-01 10:15:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000008', 'member', '2026-08-01 10:15:00+00', TRUE, NULL),
    -- Leadership Private Channel Members (Carlos, Alejandro, Valeria)
    ('10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'admin', '2026-08-01 10:30:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'admin', '2026-08-01 10:30:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'member', '2026-08-01 10:30:00+00', TRUE, NULL),
    -- Project Frontend Private Channel (Valeria, Santiago, Camila)
    ('10000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'admin', '2026-08-01 10:45:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'member', '2026-08-01 10:50:00+00', TRUE, NULL),
    ('10000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000007', 'member', '2026-08-01 10:50:00+00', TRUE, NULL)
ON CONFLICT (rw_channel_id, rw_user_id) DO NOTHING;

-- 4. Insert Messages
INSERT INTO rw_messages (rw_id, rw_channel_id, rw_author_id, rw_content, rw_metadata, rw_is_active, rw_created_at, rw_updated_at, rw_deleted_at)
VALUES
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
     '¡Bienvenidos todos a la nueva plataforma de mensajería interna de Riwi Co. S.A.S.! En este canal general compartiremos noticias institucionales y anuncios de la organización.',
     '{"client": "web", "priority": "high"}', TRUE, '2026-08-01 11:00:00+00', '2026-08-01 11:00:00+00', NULL),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
     'Excelente Carlos. Todo el equipo de ingeniería está listo para colaborar y probar las funcionalidades de IA y mensajería en tiempo real.',
     '{"client": "web"}', TRUE, '2026-08-01 11:05:00+00', '2026-08-01 11:05:00+00', NULL),
    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
     'Saludos a todos. Preparando los módulos de backend con Spring Boot y PostgreSQL 15.',
     '{"client": "mobile"}', TRUE, '2026-08-01 11:10:00+00', '2026-08-01 11:10:00+00', NULL),
    ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
     'Equipo dev: el paradigma Smart Database establece que toda la lógica de autorización RLS, triggers y constraints viva en PostgreSQL. Nada de validaciones críticas en Java.',
     '{"tag": "architecture"}', TRUE, '2026-08-01 11:30:00+00', '2026-08-01 11:30:00+00', NULL),
    ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003',
     'De acuerdo Valeria. Implementé la paginación Keyset usando el cursor (rw_created_at, rw_id). Es O(log n) y no usamos OFFSET en ninguna consulta.',
     '{"tag": "pagination"}', TRUE, '2026-08-01 11:35:00+00', '2026-08-01 11:35:00+00', NULL),
    ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004',
     'Integré pgvector con embeddings de 1536 dimensiones para el Copilot RAG. El filtro RLS se aplica directamente en la base de datos protegiendo la privacidad de los canales.',
     '{"tag": "ai-rag"}', TRUE, '2026-08-01 11:40:00+00', '2026-08-01 11:40:00+00', NULL),
    ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
     'La mensajería en tiempo real funcionará mediante WebSocket con protocolo STOMP suscrito a /topic/channels/{channelId}.',
     '{"tag": "websocket"}', TRUE, '2026-08-01 11:45:00+00', '2026-08-01 11:45:00+00', NULL),
    ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001',
     '[CONFIDENCIAL LIDERAZGO] Revisión estratégica del presupuesto Q3 y metas de empleabilidad para los coders de la cohorte 6.',
     '{"confidential": true}', TRUE, '2026-08-01 12:00:00+00', '2026-08-01 12:00:00+00', NULL),
    ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005',
     '[CONFIDENCIAL LIDERAZGO] Las métricas de desempeño y retención de talento muestran un incremento del 25% tras la adopción de los clanes.',
     '{"confidential": true}', TRUE, '2026-08-01 12:15:00+00', '2026-08-01 12:15:00+00', NULL),
    ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
     'En la reunión de despliegue se acordó desplegar los contenedores de PostgreSQL 15 con pgvector, Spring Boot 3 y React en Nginx usando Docker Compose, exponiendo el puerto 8080 para la API REST y el puerto 3000 para el frontend SPA.',
     '{"tag": "deployment"}', TRUE, '2026-08-01 11:50:00+00', '2026-08-01 11:50:00+00', NULL),
    ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002',
     'Santiago y Camila, en este chat privado de proyecto-frontend-ui coordinaremos el diseño de la interfaz estilo WhatsApp y la integración de STOMP WebSocket.',
     '{"tag": "frontend"}', TRUE, '2026-08-01 12:30:00+00', '2026-08-01 12:30:00+00', NULL),
    ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003',
     'Perfecto Valeria. Ya tengo listos los componentes de conversaciones, chat WhatsApp y copilot con Tailwind CSS.',
     '{"tag": "frontend"}', TRUE, '2026-08-01 12:35:00+00', '2026-08-01 12:35:00+00', NULL)
ON CONFLICT (rw_id) DO NOTHING;

-- 5. Insert Message Reads
INSERT INTO rw_message_reads (rw_message_id, rw_user_id, rw_read_at)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', '2026-08-01 11:02:00+00'),
    ('20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', '2026-08-01 11:08:00+00'),
    ('20000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', '2026-08-01 11:32:00+00')
ON CONFLICT (rw_message_id, rw_user_id) DO NOTHING;

-- 6. Insert Copilot Usage
INSERT INTO rw_copilot_usage (rw_id, rw_user_id, rw_query, rw_tokens_used, rw_created_at)
VALUES
    ('30000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
     '¿Cuál es la política de borrado de mensajes en la plataforma?', 142, '2026-08-01 14:00:00+00'),
    ('30000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
     '¿Cuáles fueron los temas tratados en la reunión de liderazgo?', 198, '2026-08-01 15:30:00+00')
ON CONFLICT (rw_id) DO NOTHING;

-- 7. Insert Embeddings for Seed Messages
INSERT INTO rw_embeddings (rw_message_id, rw_embedding)
SELECT rw_id, array_fill(0.01::float4, ARRAY[1536])::vector
FROM rw_messages
WHERE rw_id NOT IN (SELECT rw_message_id FROM rw_embeddings);

COMMIT;
