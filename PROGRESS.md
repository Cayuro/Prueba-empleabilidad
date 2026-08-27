# Task Execution Progress & Status Tracker

**Proyecto:** Plataforma Interna de Mensajería con IA (Riwi Co. S.A.S.)  
**Paradigma:** Smart Database (PostgreSQL 15+) — Thin Backend (Java 21 / Spring Boot 3) — React 18 Frontend (Tailwind CSS)  
**Última actualización:** 2026-08-27 11:33

---

## Tablero de Estado General

| Fase | Responsable | Estado | % Completado | Siguiente Acción |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 0 — Smart Database & Infraestructura** | `db_architect` | 🟢 Completado | 100% | DDL completo (`0001_init.sql`), RLS, triggers, seed (`seed.json`), `load-seed.sql`, `docker-compose.yml` y `.env.example`. |
| **Fase 1 — Auth & Thin Backend Base** | `backend_developer` | 🟢 Completado | 100% | Spring Boot 3, JWT 15m, rotación de tokens, logout activo, CorrelationFilter y `@ControllerAdvice`. |
| **Fase 2 — Canales, Mensajes & RLS** | `backend_developer` | 🟢 Completado | 100% | `DbContextHelper` con `SET LOCAL`, endpoints con Keyset pagination, soft-delete, read receipts y WebSocket STOMP broadcast. |
| **Fase 3 — Embeddings & Vector Store** | `backend_developer` | 🟢 Completado | 100% | Interface `EmbeddingProvider` (Mock & PgVector) y adapter `PgVectorEmbeddingRepository` en 1536 dimensiones. |
| **Fase 4 — Copilot RAG End-to-End & Gemini** | `backend_developer` | 🟢 Completado | 100% | Proveedor nativo Google Gemini (`GeminiProvider.java`), fallback seguro (`MockAiProvider.java`), endpoint `/api/copilot/query` filtrado en SQL bajo RLS con citas y `/api/copilot/usage`. |
| **Fase 5 — Frontend UI (React + Tailwind)** | `frontend_developer` | 🟢 Completado | 100% | Build completado sin errores (`npm run build`). 3 zonas UI, paleta Naranja/Negro, i18n ES/EN, registro de usuarios y WebSocket STOMP. |
| **Fase 6 — QA, Integración & Entregables** | `qa_integrator` | 🟢 Completado | 100% | 8/8 tests de integración pasando en PostgreSQL real, `README.md`, `ARCHITECTURE.md`, `ER_MODEL.md` y Swagger UI. |
| **Fase 7 — Hardening RLS, Gemini AI & Diagnóstico** | `core_team` | 🟢 Completado | 100% | Rol `rw_app` con `NOBYPASSRLS`, vista `rw_vw_user_conversations` sincronizada con alias completos, guardas de WebSocket JWT, 12/12 pruebas E2E superadas. |

---

## Detalle por Fase y Tareas

### Fase 0 — Smart Database & Infraestructura (`db_architect`)
- [x] Arquitectura de BD definida con prefijo `rw_` y `ON DELETE RESTRICT` en todas las FKs (D-01 a D-15).
- [x] DDL completo en `database/migrations/0001_init.sql` con constraints `CHECK (rw_is_active = (rw_deleted_at IS NULL))`.
- [x] Políticas RLS en tablas `rw_users`, `rw_channels`, `rw_channel_members`, `rw_messages`, `rw_message_reads`, `rw_refresh_tokens`, `rw_copilot_usage`.
- [x] Procedimientos y funciones almacenadas (`rw_sp_get_users`, `rw_sp_maintain_user`, `rw_sp_create_user`, `rw_fn_create_user`, `rw_fn_rotate_refresh_token`, `rw_sp_revoke_refresh_token`).
- [x] Vista `rw_vw_user_conversations` (con contador de no leídos `rw_message_reads` y metadatos de canal completos).
- [x] Triggers de consistencia: `trg_rw_messages_tsv`, `trg_rw_prevent_undeletion`, `trg_rw_set_updated_at`.
- [x] Rol de aplicación `rw_app` con permisos mínimos sin `DELETE` y con `NOBYPASSRLS`.
- [x] Estructura completa de `seed.json` y scripts de carga (`load-seed.sql`, `load-seed.sh`).
- [x] Configuración de `docker-compose.yml` y `.env.example`.

### Fase 1 — Autenticación & Thin Backend (`backend_developer`)
- [x] Setup proyecto Spring Boot (Java 21, Maven, Spring Web, Spring JDBC, Springdoc OpenAPI).
- [x] `JwtUtil` con claims mínimos (`sub`, `iat`, `exp`) y expiración de 15 minutos.
- [x] `JwtFilter` y endpoints `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.
- [x] `UserController` delegando a `rw_sp_get_users` y `rw_sp_maintain_user` con `JdbcTemplate`.
- [x] `CorrelationFilter` (`X-Correlation-Id` con MDC) y `GlobalExceptionHandler` (`@ControllerAdvice`).
- [x] Rate limiting en endpoints sensibles (`RateLimiterService`).

### Fase 2 — Mensajería, Keyset Pagination & WebSocket (`backend_developer`)
- [x] `DbContextHelper` con `SET LOCAL app.current_user_id = ?` en transacciones.
- [x] `ConversationController` (`/api/conversations`) consumiendo `rw_vw_user_conversations` bajo RLS.
- [x] `ChannelController` (`/api/channels`) con creación de canales públicos/privados y asignación de membresía admin.
- [x] `MessageController` (`/api/channels/{id}/messages`) con Keyset Pagination `(rw_created_at, rw_id)` sin `OFFSET`.
- [x] Endpoint de confirmación de lectura idempotente (`/api/channels/{id}/messages/{id}/read`).
- [x] `SearchController` con búsqueda full-text y resaltado `ts_headline`.
- [x] Servidor WebSocket STOMP (`/ws`) con interceptor de autenticación y autorización por canal (`JwtChannelInterceptor`, `SubscriptionInterceptor`).

### Fase 3 & 4 — Copilot RAG, Google Gemini & Embeddings (`backend_developer`)
- [x] Proveedor nativo Google Gemini (`GeminiProvider.java` para Gemini 1.5 Flash / Pro).
- [x] Proveedor seguro offline (`MockAiProvider.java`) con restricción estricta de contexto.
- [x] Regla no negociable: rechazo de preguntas matemáticas y genéricas fuera del contexto del chat.
- [x] `CopilotController` (`/api/copilot/query`) orquestando búsqueda híbrida → candidatos → filtrado SQL bajo RLS con `rw_fn_search_authorized_messages` → respuesta con citas exactas.
- [x] Registro y auditoría de consumo acumulado en `rw_copilot_usage` (`/api/copilot/usage`).

### Fase 5 — Frontend React UI (`frontend_developer`)
- [x] Scaffolding de Vite + React + Tailwind CSS.
- [x] `ThemeContext` con toggle Claro/Oscuro y paleta Naranja/Negro de alto contraste.
- [x] `LanguageContext` con internacionalización nativa Español/Inglés (sin cadenas hardcoded).
- [x] `AuthContext` con soporte completo de Login, Registro de nuevos usuarios, persistencia y auto-limpieza de tokens inválidos.
- [x] Zona 1: Conversaciones y canales con conteo de no leídos, búsqueda y creación de canales (`ZoneConversations.jsx`).
- [x] Zona 2: Chat en tiempo real, scroll Keyset sin saltos y estados de mensaje (`ZoneChat.jsx`).
- [x] Zona 3: Panel lateral Copiloto IA con caja de consulta, respuestas estructuradas y citas (`ZoneCopilot.jsx`).
- [x] Zona 4: Header y barra de perfil con métricas de consumo de IA y logout (`Header.jsx`, `UserProfileModal.jsx`).
- [x] Cliente WebSocket STOMP (`websocket.js`) con guardas de token JWT compacto.

### Fase 6 & 7 — QA, Seguridad RLS & Diagnóstico de Logs (`qa_integrator` & `core_team`)
- [x] Pruebas automatizadas de integración contra PostgreSQL real (8/8 tests pasando en `tests/integration/rls_security_test.sql`).
- [x] Suite de pruebas End-to-End (`tests/e2e_api_test.sh`: 12/12 endpoints PASSED).
- [x] Verificación de 0 errores en `rw_vw_user_conversations` (alias `rw_channel_is_private`, etc. alineados).
- [x] Verificación de conexión limpia en WebSocket STOMP.
- [x] Documentación completa: `README.md`, `ARCHITECTURE.md`, `ER_MODEL.md`, `credenciales_acceso.txt`, `docker-compose.yml`, `.env.example`.
