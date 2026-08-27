# Development Planning — Riwi Internal Messaging Platform

**Paradigma:** Smart Database (PostgreSQL 15+) — Thin Backend (Spring Boot) — React Frontend  
**Restricciones absolutas:** Sin borrado físico · Sin OFFSET · Sin SQL por concatenación · JWT del lado del servidor · RLS como fuente de verdad de permisos

---

## Decisiones de Diseño Documentadas

| ID | Decisión | Alternativa descartada | Razón |
|---|---|---|---|
| D-01 | **`ON DELETE RESTRICT` en todas las FK** | `ON DELETE CASCADE` | `CASCADE` permitiría borrado físico silencioso de `rw_messages` y `rw_embeddings` si se elimina un canal o usuario físicamente. `RESTRICT` hace que la DB rechace cualquier `DELETE` físico sobre registros referenciados, obligando a pasar siempre por el borrado lógico. |
| D-02 | **`rw_is_active` Y `rw_deleted_at` coexisten con `CHECK`** | Solo `rw_deleted_at` | Ambos campos se mantienen porque `rw_is_active` es útil para índices parciales y RLS (comparación booleana). El riesgo de divergencia se elimina con `CHECK (rw_is_active = (rw_deleted_at IS NULL))` — la DB rechaza cualquier UPDATE que los desincronice. La consistencia la enforcea el motor, no el desarrollador. |
| D-03 | **UUID como PK en todas las tablas** | SERIAL/BIGINT | UUIDs evitan enumeración secuencial de recursos, son seguros para exponer en URLs y compatibles con distribución futura. |
| D-04 | **Prefijo `rw_` en tablas y columnas** | Sin prefijo | Requerimiento explícito del negocio. Evita colisiones con palabras reservadas SQL e identifica visualmente las tablas del sistema. |
| D-05 | **`JdbcTemplate` sobre JPA/Hibernate** | Spring Data JPA | Backend delgado que delega lógica a la DB. JPA abstrae queries y dificulta llamadas directas a stored procedures y funciones SQL. `JdbcTemplate` es explícito: lo escrito es exactamente lo que se ejecuta. |
| D-06 | **Keyset Pagination por `(rw_created_at, rw_id)`** | `OFFSET` | `OFFSET` recorre filas descartadas en cada página, se degrada con volumen y puede saltar registros con inserciones concurrentes. Keyset es O(log n) y estable. |
| D-07 | **JWT solo contiene `sub`, `iat`, `exp`** | Incluir `role` en el JWT | El `role` en el token no puede usarse para autorización si RLS es la fuente de verdad. Si el rol cambia en DB, un JWT con `role` antiguo daría acceso incorrecto hasta expirar. El backend extrae solo `sub` (user_id); la DB consulta el rol real desde `rw_users` en cada transacción via RLS. |
| D-08 | **Access Token de 15 minutos** | Tokens de larga duración | Ventana de exposición mínima. Si un token se compromete, expira en 15 min. El refresh token rota en cada uso para detectar reutilización. |
| D-09 | **Privileges mínimos para `rw_app` — sin `DELETE` concedido en ninguna tabla** | `GRANT ALL TABLES TO rw_app` | Seguridad en capas: DB privileges + RLS + constraints. Aunque RLS falle o sea bypasseada, `rw_app` no tiene `DELETE` → no puede borrar físicamente. Cada tabla tiene solo los privilegios que necesita para su operación esperada. |
| D-10 | **`rw_tsv` actualizado por trigger** | Actualización desde el backend | El backend no debe conocer el esquema de indexación full-text. La DB mantiene su propio índice de búsqueda consistente y atómico con cada INSERT/UPDATE. |
| D-11 | **`AiProvider` como interface intercambiable (solo completions)** | Llamada directa a OpenAI SDK | Permite `MockAiProvider` en tests sin llamadas reales y cambio de proveedor modificando solo la implementación. Ver D-15 para embeddings. |
| D-15 | **`EmbeddingProvider` como interfaz separada de `AiProvider`** | Un único `AiProvider` con ambos métodos | Ciclos de vida, costos y proveedores distintos. ISP: intercambiables de forma independiente. |
| D-12 | **RLS filtra vector search directamente** | Función `rw_fn_search_authorized_messages` wrapeando el SELECT | Un `SELECT FROM rw_messages WHERE rw_id = ANY(candidate_ids)` activa RLS automáticamente. No se necesita función wrapper extra si las políticas están bien definidas. Menos código, misma garantía. La función puede existir por legibilidad pero no es la capa de seguridad — RLS lo es. |

---

## Árbol de dependencias

```
[FASE 0] Infraestructura y DDL
    ↓
[FASE 1] Auth & Usuarios
    ↓
[FASE 2] Canales, Mensajes y RLS
    ↓
[FASE 3] Búsqueda Full-Text y Embeddings
    ↓
[FASE 4] Copilot RAG End-to-End
    ↓
[FASE 5] Frontend React (UI Completa)
    ↓
[FASE 6] Pruebas, Docker y Entregables
```

> Las fases 0–4 son backend-first. La Fase 5 puede iniciar en paralelo desde la Fase 2 con mocks.

---

## FASE 0 — Infraestructura, DDL y Smart Database

**Goal:** Toda la lógica de negocio, integridad, acceso y consistencia vive en PostgreSQL.

### 0.1 Docker Compose
- [ ] Servicio `db`: PostgreSQL 15+ con pgvector, nombre `bd_nombre_apellido_clan`.
- [ ] Servicio `backend`: Spring Boot, variables desde `.env`.
- [ ] Servicio `frontend`: React.
- [ ] Health checks entre servicios.
- [ ] `.env.example` sin secretos reales — con todas las variables necesarias:
  ```
  # Database
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=bd_nombre_apellido_clan
  DB_USER=postgres
  DB_APP_USER=rw_app
  DB_APP_PASSWORD=changeme

  # JWT
  JWT_SECRET=changeme_min_32_chars
  JWT_EXPIRY_MINUTES=15
  REFRESH_TOKEN_EXPIRY_DAYS=30

  # AI Provider
  AI_PROVIDER=openai
  OPENAI_API_KEY=sk-...
  OPENAI_MODEL=gpt-4o

  # Embedding Provider
  EMBEDDING_PROVIDER=openai
  OPENAI_EMBEDDING_MODEL=text-embedding-ada-002

  # System Prompt
  SYSTEM_PROMPT_VERSION=1
  SYSTEM_PROMPT_PATH=/config/system-prompt-v1.txt

  # WebSocket
  WEBSOCKET_ENDPOINT=/ws
  ```

### 0.2 Migration `0001_init.sql` — DDL Completo

> Decisiones activas: D-01, D-02, D-03, D-04.

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
```

**`rw_users`**
```sql
rw_id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
rw_email       VARCHAR(255) NOT NULL
rw_password_hash VARCHAR(255) NOT NULL
rw_name        VARCHAR(100) NOT NULL
rw_role        VARCHAR(50)  NOT NULL DEFAULT 'member'
               CHECK (rw_role IN ('admin', 'member'))
rw_is_active   BOOLEAN NOT NULL DEFAULT TRUE
rw_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
rw_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
rw_deleted_at  TIMESTAMPTZ NULL
-- La DB enforcea que is_active y deleted_at nunca diverjan (D-02)
CONSTRAINT chk_rw_users_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
```

**`rw_channels`**
```sql
rw_id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
rw_name        VARCHAR(100) NOT NULL
rw_is_private  BOOLEAN NOT NULL DEFAULT FALSE
rw_created_by  UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT  -- D-01
rw_is_active   BOOLEAN NOT NULL DEFAULT TRUE
rw_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
rw_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
rw_deleted_at  TIMESTAMPTZ NULL
CONSTRAINT chk_rw_channels_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
```

**`rw_channel_members`**
```sql
rw_channel_id  UUID NOT NULL REFERENCES rw_channels(rw_id) ON DELETE RESTRICT  -- D-01
rw_user_id     UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT      -- D-01
rw_role        VARCHAR(50) NOT NULL DEFAULT 'member'
rw_joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
rw_is_active   BOOLEAN NOT NULL DEFAULT TRUE
rw_deleted_at  TIMESTAMPTZ NULL
-- Soft delete igual que el resto: CHECK enforcea coherencia (D-02)
CONSTRAINT chk_rw_channel_members_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
PRIMARY KEY (rw_channel_id, rw_user_id)
```
> Salida o remoción de un miembro → `UPDATE SET rw_deleted_at = NOW(), rw_is_active = FALSE`.
> Las políticas RLS que verifican membresía filtran siempre por `rw_is_active = TRUE`.

**`rw_messages`**
```sql
rw_id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
rw_channel_id  UUID NOT NULL REFERENCES rw_channels(rw_id) ON DELETE RESTRICT   -- D-01
rw_author_id   UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT       -- D-01
rw_content     TEXT NOT NULL CHECK (rw_content <> '')
rw_metadata    JSONB NOT NULL DEFAULT '{}'
rw_tsv         TSVECTOR  -- mantenido por trigger, no por el backend (D-10)
rw_is_active   BOOLEAN NOT NULL DEFAULT TRUE
rw_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
rw_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
rw_deleted_at  TIMESTAMPTZ NULL
CONSTRAINT chk_rw_messages_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
```

**`rw_message_reads`**
```sql
rw_message_id  UUID NOT NULL REFERENCES rw_messages(rw_id) ON DELETE RESTRICT  -- D-01
rw_user_id     UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT      -- D-01
rw_read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
PRIMARY KEY (rw_message_id, rw_user_id)
-- No soft delete: read receipts are immutable audit records
-- Used by rw_vw_user_conversations to compute unread_count
```

**`rw_embeddings`**
```sql
rw_id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
rw_message_id  UUID NOT NULL REFERENCES rw_messages(rw_id) ON DELETE RESTRICT  -- D-01
rw_embedding   VECTOR(1536) NOT NULL
rw_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**`rw_refresh_tokens`**
```sql
rw_id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
rw_user_id     UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT  -- D-01
rw_token_hash  VARCHAR(255) NOT NULL
rw_is_revoked  BOOLEAN NOT NULL DEFAULT FALSE
-- rw_is_revoked NO tiene CHECK con deleted_at: expresa estado de ciclo de vida del token, no borrado
rw_replaced_by UUID NULL REFERENCES rw_refresh_tokens(rw_id) ON DELETE RESTRICT
rw_expires_at  TIMESTAMPTZ NOT NULL
rw_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**`rw_copilot_usage`**
```sql
rw_id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
rw_user_id     UUID NOT NULL REFERENCES rw_users(rw_id) ON DELETE RESTRICT  -- D-01
rw_query       TEXT NOT NULL
rw_tokens_used INTEGER NOT NULL DEFAULT 0
rw_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- tabla de auditoría: nunca se modifica ni elimina
```

**Índices**
```sql
-- Índice único parcial: dos usuarios activos no pueden tener el mismo email (D-02)
CREATE UNIQUE INDEX idx_rw_users_email_active ON rw_users(rw_email) WHERE rw_is_active = TRUE;
-- GIN para búsqueda full-text
CREATE INDEX idx_rw_messages_tsv ON rw_messages USING GIN(rw_tsv);
-- Para keyset pagination (D-06)
CREATE INDEX idx_rw_messages_keyset ON rw_messages(rw_channel_id, rw_created_at DESC, rw_id DESC);
```

### 0.3 Rol de Aplicación y Privileges Mínimos

> Decisión D-09: tres capas de seguridad — DB privileges + RLS + constraints. Si RLS falla, el privilege lo detiene. Si el privilege falla, RLS lo detiene.

```sql
CREATE ROLE rw_app LOGIN PASSWORD '${DB_APP_PASSWORD}';

-- Sin BYPASSRLS, sin SUPERUSER, sin CREATEDB
-- GRANT granular por tabla y operación esperada:

-- rw_users: SELECT para auth, UPDATE para mantenimiento vía stored proc
GRANT SELECT, UPDATE ON rw_users TO rw_app;

-- rw_channels: SELECT (RLS filtra filas), INSERT para crear canales
GRANT SELECT, INSERT, UPDATE ON rw_channels TO rw_app;

-- rw_channel_members: SELECT e INSERT para gestión de membresías
GRANT SELECT, INSERT ON rw_channel_members TO rw_app;

-- rw_messages: SELECT (RLS filtra), INSERT (enviar), UPDATE (editar y soft delete)
-- NO DELETE concedido — la DB rechaza físicamente cualquier intento de borrado
GRANT SELECT, INSERT, UPDATE ON rw_messages TO rw_app;

-- rw_embeddings: SELECT e INSERT (el embedding se crea, nunca se edita)
GRANT SELECT, INSERT ON rw_embeddings TO rw_app;

-- rw_refresh_tokens: SELECT, INSERT, UPDATE (revocar)
GRANT SELECT, INSERT, UPDATE ON rw_refresh_tokens TO rw_app;

-- rw_copilot_usage: SELECT e INSERT (auditoría, nunca se modifica)
GRANT SELECT, INSERT ON rw_copilot_usage TO rw_app;

-- Funciones y procedimientos
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO rw_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO rw_app;
```

### 0.4 Row Level Security (RLS)

> RLS es la fuente de verdad para acceso a filas. D-12: el vector search pasa por RLS directamente.

```sql
ALTER TABLE rw_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rw_copilot_usage ENABLE ROW LEVEL SECURITY;
```

**Política `rw_channels` (SELECT):**
```sql
CREATE POLICY rw_channels_select ON rw_channels FOR SELECT TO rw_app
USING (
    rw_is_active = TRUE
    AND (
        rw_is_private = FALSE
        OR rw_id IN (
            SELECT rw_channel_id FROM rw_channel_members
            WHERE rw_user_id = current_setting('app.current_user_id')::uuid
        )
    )
);
```

**Política `rw_messages` (SELECT):**
```sql
CREATE POLICY rw_messages_select ON rw_messages FOR SELECT TO rw_app
USING (
    rw_is_active = TRUE
    AND rw_channel_id IN (
        SELECT rw_id FROM rw_channels  -- hereda la política de rw_channels automáticamente
    )
);
```

**Política `rw_copilot_usage` (SELECT):**
```sql
CREATE POLICY rw_copilot_usage_select ON rw_copilot_usage FOR SELECT TO rw_app
USING (rw_user_id = current_setting('app.current_user_id')::uuid);
```

### 0.5 Funciones y Stored Procedures

**`rw_fn_set_current_user(p_user_id UUID)`**
- [ ] `PERFORM set_config('app.current_user_id', p_user_id::text, true);`
- [ ] `true` = local a la transacción (se resetea al hacer COMMIT/ROLLBACK).
- [ ] Llamado al inicio de CADA transacción desde el backend.

**`rw_sp_get_users(p_search TEXT, p_limit INT)`**
- [ ] `ILIKE` parametrizado en `rw_name` y `rw_email` donde `rw_is_active = TRUE`.

**`rw_sp_maintain_user(p_user_id UUID, p_name VARCHAR, p_role VARCHAR, p_action VARCHAR)`**
- [ ] `'UPDATE'`: actualiza `rw_name`, `rw_role`, `rw_updated_at`.
- [ ] `'DELETE'`: `UPDATE rw_users SET rw_deleted_at = NOW(), rw_is_active = FALSE` — el CHECK enforcea coherencia. Nunca `DELETE` físico (D-01).

### 0.6 Vista `rw_vw_user_conversations`
- [ ] JOIN `rw_channels` + `rw_channel_members` + último `rw_messages` por canal.
- [ ] Solo canales con `rw_is_active = TRUE` y mensajes con `rw_is_active = TRUE`.
- [ ] RLS aplica automáticamente sobre `rw_channels` dentro de la vista.

### 0.7 Trigger `trg_rw_messages_tsv` (D-10)
- [ ] `AFTER INSERT OR UPDATE OF rw_content ON rw_messages`.
- [ ] Actualiza `rw_tsv = to_tsvector('spanish', NEW.rw_content) || to_tsvector('english', NEW.rw_content)`.

### 0.8 Seed Script
- [ ] `seed.json` con la estructura requerida por el negocio:
  ```json
  {
    "entities": ["rw_users", "rw_channels", "rw_channel_members", "rw_messages"],
    "relationships": ["users-channels via channel_members", "messages belong to channels"],
    "business_rules": [
      "No physical deletes",
      "Private channels visible only to members",
      "Messages only by channel members"
    ],
    "normalization_notes": {
      "1FN": "All attributes atomic",
      "2FN": "Members table separates user/channel concerns",
      "3FN": "No transitive dependencies"
    },
    "data": {
      "users": [...],
      "channels": [...],
      "channel_members": [...],
      "messages": [...]
    }
  }
  ```
- [ ] Script `load-seed.sh` que lee `seed.json` e inserta en la DB vía psql.

**Gate Fase 0:**
- Migraciones completas → CHECK constraints activos → RLS activo.
- Intentar `DELETE` físico en `rw_messages` → error por `RESTRICT` + sin privilege `DELETE`.
- Intentar `UPDATE rw_messages SET rw_is_active = FALSE, rw_deleted_at = NULL` → error por CHECK constraint.

---

## FASE 1 — Autenticación & Thin Backend (Spring Boot)

> Decisiones activas: D-05, D-07, D-08.

### 1.1 Configuración Base
- [ ] Dependencias: `spring-web`, `spring-jdbc`, `spring-security`, `spring-websocket`, `spring-messaging`, `jjwt`, driver PostgreSQL.
- [ ] `DataSource` con credenciales de `rw_app` (sin `BYPASSRLS`, sin `DELETE`).
- [ ] Sin valores hardcoded — todo desde variables de entorno.

### 1.2 `JwtUtil.java`

> **D-07:** El JWT solo lleva `sub` (user_id), `iat` y `exp`. Sin `role` ni ningún dato de autorización.

```json
{ "sub": "uuid-del-usuario", "iat": 1234567890, "exp": 1234568790 }
```

- [ ] Access token: **15 minutos** (D-08).
- [ ] Refresh token: UUID aleatorio, almacenado como hash BCrypt en `rw_refresh_tokens`.
- [ ] El `role` del usuario se obtiene de la DB en cada transacción, nunca del token.

### 1.3 `JwtFilter.java`
- [ ] Extiende `OncePerRequestFilter`.
- [ ] Valida `Authorization: Bearer <token>` → extrae solo `sub` (user_id UUID).
- [ ] Inyecta `current_user_id` en el `HttpServletRequest`.
- [ ] Devuelve `401` si inválido o expirado.

### 1.4 `AuthController.java`
- [ ] `POST /api/auth/login`: verifica BCrypt contra `rw_password_hash`. Emite access + refresh.
- [ ] `POST /api/auth/refresh`: valida hash en `rw_refresh_tokens` donde `rw_is_revoked = FALSE` y `rw_expires_at > NOW()`. Setea `rw_is_revoked = TRUE` en token actual. Emite nuevos tokens.
- [ ] `POST /api/auth/logout`: extrae `user_id` del access token + recibe `refresh_token` en body. `UPDATE rw_refresh_tokens SET rw_is_revoked = TRUE WHERE rw_token_hash = hash(token) AND rw_user_id = user_id`. El access token expira naturalmente en 15 min (D-08).

### 1.5 `UserController.java`
- [ ] Llama `rw_sp_get_users` y `rw_sp_maintain_user` vía `JdbcTemplate` (D-05).

### 1.6 Filtro de Correlación (`CorrelationFilter.java`)
- [ ] Extiende `OncePerRequestFilter`.
- [ ] Lee `X-Correlation-Id` del header entrante o genera UUID si no viene.
- [ ] `MDC.put("correlationId", id)` para que todos los logs de esa request lo incluyan.
- [ ] Agrega el header a la response. Limpia MDC en `finally`.

### 1.7 Manejo Uniforme de Errores (`GlobalExceptionHandler.java`)
- [ ] `@ControllerAdvice` con un método por tipo de excepción.
- [ ] Responde siempre con `{ error, message, correlation_id, timestamp }`.
- [ ] Mapea: `AccessDeniedException` → 403, `JwtException` → 401, `ConstraintViolationException` → 422, `RateLimitException` → 429.

### 1.8 Rate Limiting
- [ ] `HandlerInterceptor` con contador por clave (IP para login, user_id para copiloto).
- [ ] `POST /api/auth/login`: 10 req/min por IP.
- [ ] `POST /api/copilot/query`: 20 req/min por usuario autenticado.
- [ ] Response: `429` + header `Retry-After: <seconds>`.

### 1.9 Swagger UI (Springdoc OpenAPI)
- [ ] Agregar `springdoc-openapi-starter-webmvc-ui` al `pom.xml`.
- [ ] Anotación `@OpenAPIDefinition` en la clase principal con título, versión y descripción.
- [ ] Swagger UI disponible en `/swagger-ui.html` sin configuración adicional.

**Gate Fase 1:** Refresh token rotado invalida el anterior → test verde. Correlation ID presente en headers de respuesta y en errores JSON.

---

## FASE 2 — Canales, Mensajes y RLS

> Decisiones activas: D-01, D-02, D-06, D-12.

### 2.1 `DbContextHelper.java`
- [ ] `setCurrentUser(JdbcTemplate, UUID)` ejecuta `SET LOCAL app.current_user_id = ?`.
- [ ] Llamado al inicio de TODA transacción que toque datos protegidos.
- [ ] `SET LOCAL` garantiza que el contexto se resetea al terminar la transacción.

### 2.2 Endpoints

**`GET /api/conversations`**
- [ ] `@Transactional` → `setCurrentUser` → `SELECT * FROM rw_vw_user_conversations`.

**`GET /api/channels/{id}/messages`** (D-06 Keyset)
```sql
SELECT rw_id, rw_author_id, rw_content, rw_created_at
FROM rw_messages
WHERE rw_channel_id = ?
  AND rw_is_active = TRUE
  AND (rw_created_at, rw_id) < (?, ?)
ORDER BY rw_created_at DESC, rw_id DESC
LIMIT ?
-- RLS filtra automáticamente si el canal no es accesible
```

**`DELETE /api/channels/{id}/messages/{messageId}`**
```sql
UPDATE rw_messages
SET rw_deleted_at = NOW(), rw_is_active = FALSE
WHERE rw_id = ? AND rw_author_id = ?
-- CHECK constraint enforcea coherencia de ambos campos
-- rw_app no tiene privilege DELETE — el backend no puede borrarlo físicamente ni si quisiera
```

### 2.3 Búsqueda Full-Text
```sql
SELECT rw_id, ts_headline('spanish', rw_content, plainto_tsquery('spanish', ?)) AS snippet
FROM rw_messages
WHERE rw_tsv @@ plainto_tsquery('spanish', ?)
  AND rw_is_active = TRUE
-- RLS filtra canales privados automáticamente
```


### 2.5 WebSocket con STOMP para mensajería en tiempo real (D-14)

**Configuración del endpoint:**
- [ ] `WebSocketMessageBrokerConfigurer`: habilitar STOMP, endpoint `/ws`, broker simple en memoria para topic `/topic`.
- [ ] Topic de mensajes por canal: `/topic/channels/{channelId}`.

**Autenticación en el handshake (`JwtChannelInterceptor.java`):**
- [ ] Implementar `ChannelInterceptor` — al recibir frame `CONNECT`, extraer JWT del header y validar.
- [ ] Guardar `user_id` en el `Principal` de la sesión WebSocket — no se revalida en cada mensaje.

**Autorización al suscribirse (`SubscriptionInterceptor.java`):**
- [ ] Al recibir frame `SUBSCRIBE /topic/channels/{channelId}`, verificar que `user_id` (del Principal) es miembro del canal en la DB.
- [ ] Si no es miembro: lanzar excepción — el cliente recibe error y la suscripción no se establece.

**Broadcast tras INSERT exitoso (`MessageController.java`):**
- [ ] Después del INSERT en `rw_messages`, si la transacción hace commit:
  ```java
  messagingTemplate.convertAndSend("/topic/channels/" + channelId, messageDto);
  // SimpMessagingTemplate solo envía si el INSERT fue exitoso — el commit ocurre antes
  ```
- [ ] Si el INSERT falla: no se llama `convertAndSend`. El cliente recibe el error HTTP del REST.

**Gate Fase 2:** Test real PostgreSQL: no-miembro rechazado + canal privado aislado + DELETE físico imposible. WebSocket: cliente no miembro no puede suscribirse a topic privado.

---

## FASE 3 — Embeddings y Vector Store

> Decisión activa: D-11.

### 3.1 Interfaces de embeddings (D-15)

**`EmbeddingProvider`** — genera el vector a partir de texto:
- [ ] `float[] embed(String text)`.
- [ ] Implementaciones: `OpenAiEmbeddingProvider` y `MockEmbeddingProvider`.
- [ ] Seleccionado por variable de entorno `EMBEDDING_PROVIDER`.

**`EmbeddingRepository`** — almacena y consulta vectores en el vector store:
- [ ] `upsert(UUID messageId, float[] embedding)`.
- [ ] `querySimilar(float[] queryEmbedding, int limit)` → devuelve solo `UUID[]`, nunca contenido.
- [ ] Implementación: pgvector (`rw_embeddings`) para MVP.

### 3.2 `EmbeddingService` — orquesta las dos interfaces
- [ ] Al crear/editar mensaje: `float[] v = embeddingProvider.embed(message.content)` → `embeddingRepository.upsert(messageId, v)`.
- [ ] El embedding se genera fuera de la transacción principal — es consistencia eventual, no bloqueante.
- [ ] Mensajes con `rw_is_active = FALSE` no deben ser candidatos del vector store.

**Gate Fase 3:** Similitud devuelve IDs correctos → mensaje eliminado lógicamente no aparece.

---

## FASE 4 — Copilot RAG End-to-End

> Decisiones activas: D-07 (user_id del JWT), D-11 (AiProvider), D-12 (RLS como filtro).

### 4.1 Interfaces de IA (D-11, D-15)

**`AiProvider`** — solo completions de texto:
- [ ] `generateCompletion(String systemPrompt, String context, String query)`.
- [ ] `OpenAiProvider` y `MockAiProvider`. Seleccionado por `AI_PROVIDER` env var.

**`EmbeddingProvider`** — ya configurada en Fase 3, reutilizada aquí:
- [ ] Al consultar el copiloto: `embeddingProvider.embed(query)` → candidateIds → SELECT bajo RLS.

### 4.2 System Prompt Versionado
- [ ] Archivo `/config/system-prompt-v{N}.txt` — fuera del código fuente.
- [ ] Versión incluida en la respuesta.
- [ ] Negativas explícitas documentadas: sin permisos, fuera de alcance, contexto insuficiente.

### 4.3 Flujo RAG con RLS como única capa de autorización (D-12)

```
Vector Store
     ↓
candidate UUIDs (sin contenido, sin contexto)
     ↓
SELECT rw_id, rw_content FROM rw_messages
WHERE rw_id = ANY(candidate_ids)
  AND rw_is_active = TRUE
     ↓
RLS automáticamente descarta cualquier mensaje
de canal privado al que el usuario no pertenece
     ↓
Solo filas autorizadas llegan al backend
     ↓
Armar prompt → AiProvider
```

`POST /api/copilot/query`:
1. Extrae `user_id` del JWT — `sub` únicamente (D-07).
2. `@Transactional` → `SET LOCAL app.current_user_id = user_id`.
3. Embedding del query → `querySimilar(...)` → `candidateIds[]`.
4. `SELECT rw_id, rw_content FROM rw_messages WHERE rw_id = ANY(?) AND rw_is_active = TRUE` — RLS filtra (D-12).
5. Si resultado vacío → `"Insufficient authorized context."` sin llamar al LLM.
6. Construye prompt → `AiProvider.generateCompletion(...)`.
7. `INSERT INTO rw_copilot_usage (rw_user_id, rw_query, rw_tokens_used)`.
8. Retorna `{ answer, used_message_ids, citations, tokens_used }`.

### 4.4 `GET /api/copilot/usage`
```sql
SELECT COUNT(*) AS total_queries, SUM(rw_tokens_used) AS total_tokens, MAX(rw_created_at) AS last_query_at
FROM rw_copilot_usage
WHERE rw_user_id = ?
-- RLS enforcea que solo el propio usuario puede ver su consumo
```

**Gate Fase 4:** MockAiProvider + ID privado del vector store → RLS lo descarta en el SELECT → LLM nunca recibe contenido privado → citas válidas en respuesta.

---

## FASE 5 — Frontend React

### 5.1 Setup
- [ ] Vite + React + Tailwind CSS. Sin Redux/Zustand.
- [ ] Sin strings hardcoded — todo en diccionario `translations`.

### 5.2 `ThemeContext` + `LanguageContext`
- [ ] Toggle `'light' | 'dark'` y `'es' | 'en'`.
- [ ] Paleta oscuro: fondo `#0B0B0B`, acento `#FF7A20`.
- [ ] Paleta claro: fondo `#F9F9F9`, acento `#E65F00`.

### 5.3 Las 3 Zonas
- [ ] **Conversaciones:** lista keyset, carga diferida, scroll preservado, estados cargando/vacío/error.
- [ ] **Copiloto:** query input, respuesta con citas linkables.
- [ ] **Perfil:** datos del usuario, logout.

### 5.4 Cliente WebSocket (D-14)
- [ ] Instalar `@stomp/stompjs` y `sockjs-client`.
- [ ] Conectar al handshake `/ws` con JWT en header al montar el componente de conversación.
- [ ] Suscribirse a `/topic/channels/{channelId}` al abrir un canal.
- [ ] Al recibir mensaje por WebSocket: agregar al estado local directamente, sin recargar historial REST.
- [ ] Manejar estados de conexión: `CONNECTING`, `CONNECTED`, `DISCONNECTED`, `ERROR` con indicadores visibles.
- [ ] Reintentar conexión con backoff exponencial al desconectarse.

### 5.5 Estados de Mensajes
- [ ] `pending` → `sent` → `failed` (permite reintentar).

**Gate Fase 5:** UI responsiva — flujo completo login → mensaje → copiloto.

---

## FASE 6 — Tests, Docker y Entregables

### 6.1 Tests de Integración (PostgreSQL real)
- [ ] Usuario no miembro accede a canal privado → rechazado por RLS.
- [ ] Canal privado de usuario B invisible para usuario A.
- [ ] Soft delete en mensajes: fila permanece con `rw_is_active = FALSE` y `rw_deleted_at` seteado.
- [ ] Soft delete en membresía: miembro removido no aparece en RLS de mensajes del canal.
- [ ] Logout: refresh token revocado → intento de refresh retorna 401.
- [ ] Intentar `UPDATE rw_messages SET rw_is_active = FALSE, rw_deleted_at = NULL` → error por CHECK.
- [ ] Refresh token rotado invalida el anterior.
- [ ] Paginación keyset: sin duplicados ni saltos entre páginas.
- [ ] `DELETE FROM rw_messages` con rol `rw_app` → `ERROR: permission denied` (Capa 2, D-13).
- [ ] `POST .../read` duplicado → 204 sin error (ON CONFLICT DO NOTHING idempotente).
- [ ] `unread_count` en conversaciones refleja mensajes no leídos correctamente.
- [ ] `UPDATE rw_messages SET rw_deleted_at = NULL` en fila eliminada → `ERROR` por trigger anti-undeletion (Capa 4, D-13).
- [ ] `INSERT INTO rw_messages` con `rw_author_id` de otro usuario → rechazado por RLS INSERT (Capa 3, D-13).
- [ ] `UPDATE rw_messages` de mensaje ajeno → 0 rows (RLS UPDATE silencioso, D-13).
- [ ] Vector search con ID privado → SELECT bajo RLS devuelve 0 filas → LLM no llamado.

### 6.2 Tests de Contrato (`tests/contract/`)
- [ ] Shape correcto de todos los endpoints.
- [ ] Copilot devuelve `used_message_ids` y `citations` con UUIDs válidos.

### 6.3 Docker Final
- [ ] `docker compose up` levanta todo sin pasos manuales.
- [ ] Comandos de migraciones y seed documentados en `README.md`.

### 6.4 Entregables
- [ ] `README.md` — arranque desde cero.
- [ ] `ARCHITECTURE.md` — diagrama de capas y flujos.
- [ ] `DECISIONS.md` — decisiones D-01 a D-12 con alternativas y razones.
- [ ] DDL completo + `seed.json` + scripts DML + consultas SQL 1–4.
- [ ] Swagger UI en `/swagger-ui.html` (Springdoc, zero config tras añadir dependencia).
- [ ] ER diagram exportado como PNG/PDF (usar dbdiagram.io o Mermaid → PDF) — entregable explícito requerido.
- [ ] `ARCHITECTURE.md` en la raíz del proyecto (no solo `spec/architecture.md`) con diagrama Mermaid, flujos principales y descripción de capas.

---

## Orden de Implementación

| # | Tarea | Depende de | Decisiones |
|---|---|---|---|
| 1 | Docker Compose skeleton | — | — |
| 2 | DDL completo (`0001_init.sql`) | 1 | D-01, D-02, D-03, D-04 |
| 3 | Privileges mínimos para `rw_app` | 2 | D-09 |
| 4 | RLS policies | 2 | D-12 |
| 5 | Stored procedures y funciones SQL | 2 | D-02 |
| 6 | Vista `rw_vw_user_conversations` + trigger `trg_rw_messages_tsv` | 2 | D-10 |
| 7 | Seed script | 2 | — |
| 8 | Spring Boot base + `JwtUtil` (solo sub/iat/exp) + `JwtFilter` | 1 | D-05, D-07, D-08 |
| 9 | `POST /api/auth/login` y `/refresh` | 3, 4, 5, 8 | D-07, D-08 |
| 10 | Endpoints de usuarios (`rw_sp_get_users`, `rw_sp_maintain_user`) | 5, 8 | D-05 |
| 11 | `DbContextHelper` + `@Transactional` con `SET LOCAL` | 4, 8 | D-12 |
| 12 | Endpoints canales y conversaciones | 6, 11 | D-01, D-02 |
| 13 | Endpoints mensajes (keyset) | 11, 12 | D-01, D-02, D-06 |
| 14 | Búsqueda full-text (`ts_headline`) | 6, 13 | D-10 |
| 15 | `EmbeddingProvider` + `EmbeddingRepository` (pgvector) + `EmbeddingService` | 13 | D-15 |
| 16 | `AiProvider` interface (completions) + `OpenAiProvider` + `MockAiProvider` | 15 | D-11 |
| 17 | `POST /api/copilot/query` orquestación | 4, 15, 16 | D-07, D-12 |
| 18 | `rw_copilot_usage` registro y consulta | 17 | D-09 |
| 19 | Tests de integración PostgreSQL | 3–18 | todos |
| 20 | React App + ThemeContext + i18n | — (paralelo desde #12) | — |
| 21 | Zonas UI + integración con API | 20 + endpoints | — |
| 22 | Tests E2E frontend | 21 | — |
| 23 | `DECISIONS.md`, `README.md`, `ARCHITECTURE.md` | todos | D-01 a D-12 |

---

## Recordatorio MVP — Sencillez por encima de elegancia

> Este planning documenta las decisiones correctas de arquitectura. Pero es un MVP que debe poder construirlo y explicarlo un desarrollador junior. Si en algún momento la implementación se siente compleja, es una señal de que se está sobre-ingeniando.

### Reglas de implementación simple

**El código debe poder explicarse línea a línea.**  
Si alguien lee el código y no entiende qué hace sin un diagrama, hay que simplificarlo. Las decisiones arquitecturales (D-01 a D-15) se mantienen porque son correctas, pero la implementación de cada una debe ser la más directa posible.

**No enterprise:**

| ❌ No hacer | ✅ Hacer en su lugar |
|---|---|
| Factories abstractas para cada interface | Una clase, un `if` sobre la variable de entorno |
| Layers de mappers DTO ↔ Entity ↔ Domain | `Map<String, Object>` directo de `JdbcTemplate` para MVP |
| Módulos Maven separados por capa | Un solo módulo con paquetes claros |
| Event bus interno para el broadcast WebSocket | `messagingTemplate.convertAndSend(...)` directo después del INSERT |
| Pipeline de validación genérica | Un `if` explícito donde se necesite validar |
| Repository pattern sobre `JdbcTemplate` | `JdbcTemplate` inyectado directamente en el controlador o servicio |

**Interfaces (D-11, D-15) — implementación mínima:**  
Una interfaz, dos implementaciones (real y mock), una variable de entorno que decide cuál usar. No hace falta un framework de inyección de dependencias complejo: Spring Boot `@ConditionalOnProperty` o un simple `@Bean` con un `if` es suficiente.

**RLS y funciones SQL (D-12, D-13) — el junior debe entender el SQL.**  
Cada función y política RLS debe tener un comentario de una línea que explique qué hace. No comentarios de bloque, no documentación extensa: una línea que cualquiera pueda leer y entender.

**Tests — dos pruebas reales valen más que diez mocks anidados.**  
Los tests de integración contra PostgreSQL real son el corazón de la prueba. Un test que conecta a la DB real, inserta un usuario, intenta leer un canal privado y verifica que el resultado sea vacío es más valioso y más fácil de explicar que diez niveles de mocking.

**Si hay duda entre la solución correcta y la solución simple: elegir la simple que sea correcta.**  
Las decisiones de seguridad (RLS, RESTRICT, CHECK) no se negocian. El resto se puede hacer de la forma más directa posible.
