# DECISIONS.md — Architectural Decision Records

Plataforma Interna de Mensajería con IA — Riwi Co. S.A.S.  
Cada decisión registra qué se eligió, qué se descartó y por qué.

---

## D-01 — `ON DELETE RESTRICT` en todas las claves foráneas

**Contexto:**  
El sistema prohíbe el borrado físico de mensajes y de cualquier entidad referenciada. Al diseñar las FK, la opción más común es `ON DELETE CASCADE`.

**Decisión:**  
Todas las FK usan `ON DELETE RESTRICT` sin excepción.

**Alternativa descartada:**  
`ON DELETE CASCADE` en `rw_messages`, `rw_embeddings`, `rw_refresh_tokens` y `rw_copilot_usage`.

**Razón:**  
`CASCADE` permitiría que un `DELETE` físico sobre un canal o usuario eliminara silenciosamente sus mensajes, embeddings y registros de auditoría, violando la regla de negocio de no borrado físico. Con `RESTRICT`, la DB rechaza el `DELETE` con error explícito si hay filas que lo referencian. El borrado lógico mediante `rw_deleted_at` es el único camino permitido, y `RESTRICT` lo enforcea estructuralmente.

**Consecuencia:**  
Ningún `DELETE` físico puede ejecutarse sobre tablas referenciadas mientras existan filas dependientes. Esto es una garantía de la DB, no una convención del código.

---

## D-02 — `rw_is_active` y `rw_deleted_at` coexisten con `CHECK` de consistencia

**Contexto:**  
Hay dos formas naturales de representar un borrado lógico: un campo booleano (`rw_is_active`) o un timestamp nullable (`rw_deleted_at`). Usar ambos crea riesgo de estados inconsistentes.

**Decisión:**  
Ambos campos coexisten en las tablas que soportan borrado lógico, enlazados por un CHECK constraint que la DB enforcea:

```sql
CONSTRAINT chk_rw_users_active           CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_channels_active        CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_channel_members_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_messages_active        CHECK (rw_is_active = (rw_deleted_at IS NULL))
```

**Alternativa descartada:**  
Solo `rw_deleted_at`, eliminando `rw_is_active`.

**Alcance:**  
Aplica a `rw_users`, `rw_channels`, `rw_channel_members` y `rw_messages`. `rw_channel_members` tiene soft delete porque la salida o remoción de un miembro debe preservar el historial de quién perteneció al canal y cuándo.

**Razón:**  
`rw_is_active` es más eficiente para índices parciales (`WHERE rw_is_active = TRUE`) y para políticas RLS con comparaciones booleanas directas. `rw_deleted_at` aporta el timestamp exacto de la operación para auditoría. El riesgo de divergencia entre ambos se elimina con el CHECK: cualquier `UPDATE` que los desincronice produce un error de constraint antes de persistirse. La consistencia la enforcea el motor, no el desarrollador.

**Excepción documentada:**  
`rw_refresh_tokens` tiene `rw_is_revoked BOOL` sin CHECK asociado a `rw_deleted_at` porque `rw_is_revoked` expresa un estado de ciclo de vida del token (activo → revocado → reemplazado), no un borrado. Son conceptos distintos.

**Consecuencia:**  
En todo el código, el borrado lógico siempre hace ambas actualizaciones:
```sql
UPDATE ... SET rw_deleted_at = NOW(), rw_is_active = FALSE WHERE ...
```
Si solo se actualiza uno de los dos, la DB rechaza la operación.

`rw_channel_members` agrega los campos:
```sql
rw_is_active   BOOLEAN NOT NULL DEFAULT TRUE
rw_deleted_at  TIMESTAMPTZ NULL
CONSTRAINT chk_rw_channel_members_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
```
Cuando un usuario abandona o es removido de un canal: soft delete en `rw_channel_members`. Las políticas RLS de `rw_channels` y `rw_messages` que verifican membresía deben filtrar por `rw_channel_members.rw_is_active = TRUE`.

---

## D-03 — UUID como clave primaria en todas las tablas

**Contexto:**  
Al diseñar los identificadores primarios se evalúan UUIDs versus enteros secuenciales (SERIAL/BIGINT).

**Decisión:**  
`UUID PRIMARY KEY DEFAULT gen_random_uuid()` en todas las tablas.

**Alternativa descartada:**  
`BIGSERIAL` o `SERIAL` con autoincremento.

**Razón:**  
Los enteros secuenciales son predecibles: un atacante que obtiene el ID 42 sabe que existen el 41 y el 43. Los UUIDs generados con `gen_random_uuid()` son criptográficamente impredecibles, seguros para exponerse en URLs de API sin revelar el volumen ni la secuencia de datos. Son también compatibles con distribución futura y no requieren coordinar un generador central de secuencias.

**Consecuencia:**  
Todos los endpoints exponen UUIDs en sus paths y respuestas. El frontend nunca asume secuencia entre IDs.

---

## D-04 — Prefijo `rw_` en todos los nombres de tablas y columnas

**Contexto:**  
El sistema corre en PostgreSQL compartido potencialmente con otros esquemas o extensiones. Los nombres de entidades del dominio pueden colisionar con palabras reservadas (`user`, `role`, `message`).

**Decisión:**  
Todas las tablas y columnas del sistema llevan el prefijo `rw_` (ej: `rw_users`, `rw_email`, `rw_channel_id`).

**Alternativa descartada:**  
Nombres sin prefijo o uso de esquema separado (`messaging.users`).

**Razón:**  
Requerimiento explícito del negocio. Adicionalmente, el prefijo evita colisiones con palabras reservadas de SQL, permite identificar visualmente a qué sistema pertenece cada tabla en consultas cruzadas y facilita el uso de `GRANT ON ALL TABLES IN SCHEMA public` con certeza de qué se está otorgando.

**Consecuencia:**  
Todo el DDL, funciones, vistas, triggers y procedimientos usan `rw_` como prefijo. El backend mapea directamente los nombres de columnas sin alias, manteniendo la correspondencia explícita.

---

## D-05 — `JdbcTemplate` sobre JPA/Hibernate

**Contexto:**  
Spring Boot ofrece Spring Data JPA como solución ORM estándar. El paradigma de la aplicación es Smart Database con lógica en stored procedures y funciones SQL.

**Decisión:**  
`JdbcTemplate` para todas las operaciones de base de datos.

**Alternativa descartada:**  
Spring Data JPA / Hibernate.

**Razón:**  
El backend debe ser deliberadamente delgado: su trabajo es abrir transacciones, propagar el contexto del usuario y llamar a funciones y procedimientos de la DB. JPA fue diseñado para que el ORM genere SQL automáticamente, lo cual es contradictorio con el paradigma Smart Database donde el SQL es el artefacto principal. Con `JdbcTemplate`, cada llamada a la DB es explícita y legible: lo escrito en Java es exactamente lo que llega a PostgreSQL. Las llamadas a stored procedures (`rw_sp_get_users`, `rw_sp_maintain_user`) y a funciones (`rw_fn_set_current_user`) son directas y sin abstracción que las oculte.

**Consecuencia:**  
No hay entidades JPA ni anotaciones `@Entity`. Los resultados de queries se mapean como `Map<String, Object>` o clases Java simples. El código del backend es comprensible para alguien que no conozca Spring, con solo leer las líneas.

---

## D-06 — Paginación por Keyset en `(rw_created_at, rw_id)`

**Contexto:**  
El historial de mensajes de un canal puede tener miles de registros. Se necesita paginación estable y eficiente.

**Decisión:**  
Keyset Pagination usando el cursor compuesto `(rw_created_at, rw_id)`:
```sql
WHERE (rw_created_at, rw_id) < (:cursor_created_at, :cursor_id)
ORDER BY rw_created_at DESC, rw_id DESC
LIMIT :limit
```

**Alternativa descartada:**  
`OFFSET`-based pagination.

**Razón:**  
`OFFSET` recorre y descarta todas las filas anteriores en cada página, con costo O(n) que se degrada a medida que crece el dataset. Adicionalmente, `OFFSET` produce resultados inestables con inserciones concurrentes: un mensaje nuevo puede hacer que una fila aparezca en dos páginas o se salte. Keyset Pagination es O(log n) gracias al índice, estable bajo concurrencia y prohíbe explícitamente el uso de `OFFSET` según los requerimientos del negocio.

**Consecuencia:**  
El índice `idx_rw_messages_keyset ON rw_messages(rw_channel_id, rw_created_at DESC, rw_id DESC)` soporta esta consulta. Los cursores se pasan como query params en la API.

---

## D-07 — JWT contiene únicamente `sub`, `iat` y `exp`

**Contexto:**  
Es común incluir información del usuario en el JWT (`role`, `email`, `name`) para evitar consultas adicionales a la DB.

**Decisión:**  
El JWT solo incluye tres claims estándar:
```json
{ "sub": "uuid-del-usuario", "iat": 1234567890, "exp": 1234568790 }
```

**Alternativa descartada:**  
Incluir `role`, `email` u otros atributos del usuario en el token.

**Razón:**  
Si el `role` se incluye en el JWT, un usuario cuyo rol cambia en la DB sigue teniendo acceso de nivel anterior durante los 15 minutos de vida del token. RLS es la fuente de verdad para autorización: las políticas consultan `rw_users` en tiempo real dentro de cada transacción. Incluir `role` en el token crearía una segunda fuente de verdad con posibilidad de desfase. El backend extrae solo el `sub` (user_id) y propaga ese ID a la DB; la DB decide qué puede ver y hacer ese usuario consultando su propio estado actual.

**Consecuencia:**  
El backend nunca toma decisiones de autorización basadas en el contenido del JWT más allá de verificar que el token es válido y extraer el `sub`. Toda autorización la resuelve la DB.

---

## D-08 — Access Token con expiración de 15 minutos

**Contexto:**  
La vida útil del access token es un balance entre seguridad y experiencia de usuario.

**Decisión:**  
Access token con TTL de 15 minutos. Refresh token con rotación en cada uso.

**Alternativa descartada:**  
Tokens de 1 hora o más, o tokens sin expiración.

**Razón:**  
15 minutos limita la ventana de exposición si un token es interceptado o filtrado en logs. El refresh token rota en cada uso: al usarlo para obtener un nuevo par, el token anterior queda marcado como `rw_is_revoked = TRUE`. Si un atacante intenta reutilizar un refresh token ya rotado, el sistema lo detecta porque el token usado ya está revocado, indicando posible compromiso.

**Consecuencia:**  
El cliente renueva el access token automáticamente antes de los 15 minutos o al recibir un `401`.

**Logout activo — `POST /api/auth/logout`:**  
El logout sí requiere un endpoint explícito. Con refresh tokens rotativos, un token robado después del logout seguiría siendo válido indefinidamente si no se revoca. El flujo es:

```
1. Cliente envía POST /api/auth/logout con el refresh_token en el body.
2. Backend busca el token por hash en rw_refresh_tokens.
3. UPDATE rw_refresh_tokens SET rw_is_revoked = TRUE WHERE rw_token_hash = hash(token).
4. El access token expira naturalmente en 15 minutos (ventana de exposición aceptable para MVP).
5. Si el cliente intenta usar el refresh_token revocado: 401 Unauthorized.
```

El access token no puede ser invalidado antes de su expiración (naturaleza stateless de JWT). La ventana de 15 minutos es aceptable para MVP. Si en el futuro se necesita invalidación inmediata del access token, se implementa una blocklist en memoria (Redis). Por ahora revocar el refresh token es suficiente.

---

## D-09 — Privileges mínimos para el rol `rw_app` — sin `DELETE` en ninguna tabla

**Contexto:**  
Al crear el rol de aplicación para la DB, se debe decidir el nivel de acceso que tiene sobre las tablas.

**Decisión:**  
`GRANT` granular por tabla y por operación esperada. **Ninguna tabla tiene `DELETE` concedido al rol `rw_app`.**

```sql
GRANT SELECT, UPDATE              ON rw_users           TO rw_app;
GRANT SELECT, INSERT, UPDATE      ON rw_channels         TO rw_app;
GRANT SELECT, INSERT              ON rw_channel_members  TO rw_app;
GRANT SELECT, INSERT, UPDATE      ON rw_messages         TO rw_app;
GRANT SELECT, INSERT              ON rw_embeddings       TO rw_app;
GRANT SELECT, INSERT, UPDATE      ON rw_refresh_tokens   TO rw_app;
GRANT SELECT, INSERT              ON rw_copilot_usage    TO rw_app;
```

**Alternativa descartada:**  
`GRANT ALL TABLES TO rw_app` o `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES`.

**Razón:**  
El modelo de seguridad tiene tres capas en serie:
1. **DB privileges** — qué operaciones puede ejecutar el rol.
2. **RLS** — qué filas puede ver o modificar.
3. **Constraints** — qué valores son válidos.

Si RLS tiene un error de configuración, los privileges impiden el daño. Si un `DELETE` físico fuera ejecutado por error desde el backend, la DB lo rechazaría porque `rw_app` no tiene ese privilege, independientemente de si RLS lo hubiera bloqueado o no. Es defensa en profundidad: capas independientes que no se anulan mutuamente.

**Consecuencia:**  
Cualquier intento de `DELETE` físico desde el backend retorna un error de privilege de la DB, sin importar el estado de RLS ni los constraints. El borrado lógico (`UPDATE SET rw_deleted_at`) es el único mecanismo posible para `rw_app`.

---

## D-10 — `rw_tsv` mantenido por trigger, no por el backend

**Contexto:**  
`rw_messages` tiene un campo `rw_tsv TSVECTOR` para búsqueda full-text. Este campo debe actualizarse cada vez que `rw_content` cambia.

**Decisión:**  
Trigger `trg_rw_messages_tsv` en PostgreSQL actualiza `rw_tsv` automáticamente:
```sql
AFTER INSERT OR UPDATE OF rw_content ON rw_messages
-- NEW.rw_tsv = to_tsvector('spanish', NEW.rw_content) || to_tsvector('english', NEW.rw_content)
```

**Alternativa descartada:**  
El backend calcula `to_tsvector` y lo envía en el INSERT/UPDATE.

**Razón:**  
El backend no debe conocer el esquema de indexación full-text de la DB. Si se cambia el idioma del índice, los campos incluidos o la estrategia de tokenización, ese cambio ocurre solo en la migración SQL sin tocar el código del backend. El trigger garantiza que `rw_tsv` sea siempre consistente con `rw_content` de forma atómica: no hay ventana de tiempo en que el mensaje exista sin su vector de búsqueda.

**Consecuencia:**  
El backend hace un INSERT/UPDATE normal de `rw_content`. El trigger se encarga de `rw_tsv`. El índice GIN sobre `rw_tsv` está disponible inmediatamente para búsquedas.

---

## D-11 — `AiProvider` como interface intercambiable

**Contexto:**  
El copiloto necesita llamar a un LLM externo. La elección del proveedor puede cambiar (OpenAI, Anthropic, Gemini, modelo local).

**Decisión:**  
Interface Java `AiProvider` con método `generateCompletion(String systemPrompt, String context, String query)`. Implementaciones: `OpenAiProvider` y `MockAiProvider`. El proveedor activo se selecciona por variable de entorno.

**Alternativa descartada:**  
Llamada directa al SDK de OpenAI desde el caso de uso del copiloto.

**Razón:**  
Si el SDK se llama directamente, cambiar de proveedor requiere modificar la lógica de negocio. Con la interface, cambiar de proveedor es cambiar la implementación inyectada, sin tocar el flujo de orquestación. El `MockAiProvider` permite tests de integración del flujo RAG completo sin costos de API ni dependencias externas, verificando que el prompt armado contiene exactamente el contexto autorizado.

**Consecuencia:**  
El case de uso del copiloto no importa clases de OpenAI. Solo conoce la interface. Los tests usan `MockAiProvider` por defecto.

---

## D-12 — RLS como único mecanismo de autorización en el vector search

**Contexto:**  
El flujo RAG recupera candidatos del vector store (IDs de mensajes) y luego necesita verificar que el usuario tiene acceso a esos mensajes antes de pasarlos al LLM.

**Decisión:**  
Un `SELECT` directo sobre `rw_messages` con los IDs candidatos activa RLS automáticamente:
```sql
SELECT rw_id, rw_content
FROM rw_messages
WHERE rw_id = ANY(:candidate_ids)
  AND rw_is_active = TRUE
-- RLS filtra filas de canales privados a los que el usuario no pertenece
```

**Alternativa descartada:**  
Una función `rw_fn_search_authorized_messages(UUID[])` como capa de autorización explícita separada del SELECT directo.

**Razón:**  
RLS es la fuente de verdad. Si las políticas están bien definidas, cualquier `SELECT FROM rw_messages` ejecutado bajo el contexto de `app.current_user_id` ya está autorizado por definición. Agregar una función wrapper no añade seguridad adicional — simplemente repite lo que RLS ya hace. Menos código significa menos superficie de error. La función puede existir como utilitario de legibilidad, pero no es la capa de seguridad; RLS lo es.

**Requisito previo:**  
Antes de este SELECT, el backend siempre ejecuta `SET LOCAL app.current_user_id = ?` en la misma transacción. Sin este paso, las políticas RLS no tienen usuario de contexto y deniegan todo acceso.

**Consecuencia:**  
El vector store devuelve IDs candidatos. El backend los pasa en un `SELECT` parametrizado. RLS descarta silenciosamente cualquier ID que pertenezca a un canal privado al que el usuario no tiene acceso. El LLM solo recibe el contenido que RLS permitió. No existe código de autorización en el backend para esta operación.

---

*Última actualización: 2026-08-27*  
*Todas las decisiones deben revisarse si cambian las restricciones de negocio o el stack tecnológico.*

---

## D-13 — PostgreSQL como frontera de seguridad independiente del backend

**Contexto:**  
Un backend comprometido, mal configurado o con un bug puede enviar queries arbitrarias a la DB. El sistema no puede asumir que el backend es correcto. PostgreSQL debe ser capaz de impedir cualquier estado inválido y cualquier acceso no autorizado por sus propios medios, sin depender de validaciones del backend.

**Decisión:**  
PostgreSQL es la última línea de defensa. Sus mecanismos se organizan en cuatro capas independientes que actúan en serie. Si una falla, las otras lo detienen.

```
Capa 1 — Schema Constraints    → impiden estados inválidos
Capa 2 — DB Privileges         → impiden operaciones no permitidas al rol
Capa 3 — RLS Policies          → impiden acceso no autorizado a filas
Capa 4 — Triggers de Auditoría → registran accesos sensibles independientemente
```

**Alternativa descartada:**  
Confiar en que el backend valide correctamente antes de llegar a la DB.

**Razón:**  
El backend puede tener bugs, puede ser bypasseado mediante una conexión directa a la DB, o puede recibir input malicioso. Si la seguridad vive solo en el backend, un solo punto de falla compromete todo el sistema. Con las cuatro capas en PostgreSQL, la seguridad es verificable directamente contra la DB sin ejecutar el backend, y los tests de integración pueden probarla llamando funciones SQL directamente.

---

### Capa 1 — Constraints que impiden estados inválidos

Estos constraints actúan antes de persistir cualquier fila. El backend no puede crear un estado inválido aunque lo intente.

**Coherencia de borrado lógico (D-02):**
```sql
CONSTRAINT chk_rw_users_active           CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_channels_active        CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_channel_members_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_messages_active        CHECK (rw_is_active = (rw_deleted_at IS NULL))
```

**Validación de dominio:**
```sql
-- Roles válidos únicamente
CONSTRAINT chk_rw_users_role    CHECK (rw_role IN ('admin', 'member'))
CONSTRAINT chk_rw_members_role  CHECK (rw_role IN ('admin', 'member'))
-- Contenido de mensaje no vacío ni solo espacios
CONSTRAINT chk_rw_messages_content CHECK (TRIM(rw_content) <> '')
-- Consumo de tokens no puede ser negativo
CONSTRAINT chk_rw_copilot_tokens    CHECK (rw_tokens_used >= 0)
-- Refresh token no puede reemplazarse a sí mismo
CONSTRAINT chk_rw_tokens_no_self    CHECK (rw_replaced_by <> rw_id)
```

**Unicidad condicional:**
```sql
-- Dos usuarios activos no pueden tener el mismo email
CREATE UNIQUE INDEX idx_rw_users_email_active ON rw_users(rw_email)
WHERE rw_deleted_at IS NULL;

-- Un usuario solo puede ser miembro de un canal una vez
-- (garantizado por PRIMARY KEY compuesto)
PRIMARY KEY (rw_channel_id, rw_user_id) ON rw_channel_members
```

**NOT NULL en campos críticos:**  
Ningún mensaje puede existir sin `rw_channel_id`, `rw_author_id` o `rw_content`. Ningún usuario sin `rw_email` o `rw_password_hash`. Definidos en el DDL, no en el backend.

---

### Capa 2 — DB Privileges que impiden operaciones no autorizadas al rol `rw_app`

Independientemente de RLS, el rol `rw_app` no puede ejecutar operaciones que no le fueron concedidas.

```
Operación            | Impacto si faltara
---------------------|------------------------------------------------------------
Sin DELETE           | Borrado físico imposible aunque el backend lo intente
Sin TRUNCATE         | Vaciado masivo de tablas imposible
Sin DROP             | Destrucción del esquema imposible
Sin ALTER TABLE      | Modificación del DDL imposible en runtime
Sin BYPASSRLS        | RLS siempre se aplica, sin excepción
```

**Consecuencia verificable:** ejecutar `DELETE FROM rw_messages` con el rol `rw_app` retorna `ERROR: permission denied` sin importar qué diga RLS.

---

### Capa 3 — RLS Policies completas (SELECT, INSERT y UPDATE)

Las políticas anteriores cubrían solo SELECT. Para que PostgreSQL sea independiente del backend, también debe controlar qué filas puede crear o modificar cada usuario.

**`rw_messages` — INSERT:**
```sql
CREATE POLICY rw_messages_insert ON rw_messages FOR INSERT TO rw_app
WITH CHECK (
    rw_author_id = current_setting('app.current_user_id')::uuid
    AND rw_channel_id IN (
        SELECT rw_channel_id FROM rw_channel_members
        WHERE rw_user_id = current_setting('app.current_user_id')::uuid
    )
);
-- Un usuario solo puede insertar mensajes como sí mismo y solo en canales donde es miembro
```

**`rw_messages` — UPDATE (edición y soft delete):**
```sql
CREATE POLICY rw_messages_update ON rw_messages FOR UPDATE TO rw_app
USING (
    rw_author_id = current_setting('app.current_user_id')::uuid
    AND rw_is_active = TRUE
)
WITH CHECK (
    rw_author_id = current_setting('app.current_user_id')::uuid
);
-- Un usuario solo puede modificar sus propios mensajes activos
-- No puede modificar mensajes de otros aunque sean del mismo canal
```

**`rw_channels` — INSERT:**
```sql
CREATE POLICY rw_channels_insert ON rw_channels FOR INSERT TO rw_app
WITH CHECK (
    rw_created_by = current_setting('app.current_user_id')::uuid
);
```

**`rw_channels` — UPDATE:**
```sql
CREATE POLICY rw_channels_update ON rw_channels FOR UPDATE TO rw_app
USING (
    rw_created_by = current_setting('app.current_user_id')::uuid
    OR EXISTS (
        SELECT 1 FROM rw_channel_members
        WHERE rw_channel_id = rw_channels.rw_id
          AND rw_user_id = current_setting('app.current_user_id')::uuid
          AND rw_role = 'admin'
          AND rw_is_active = TRUE
    )
);
```

**`rw_channel_members` — INSERT y soft delete (UPDATE):**
```sql
-- Membresías: INSERT controlado por admins del canal o por el propio usuario (canales públicos)
CREATE POLICY rw_channel_members_insert ON rw_channel_members FOR INSERT TO rw_app
WITH CHECK (
    rw_channel_id IN (
        SELECT rw_id FROM rw_channels WHERE rw_is_private = FALSE
    )
    OR EXISTS (
        SELECT 1 FROM rw_channel_members cm
        WHERE cm.rw_channel_id = rw_channel_members.rw_channel_id
          AND cm.rw_user_id = current_setting('app.current_user_id')::uuid
          AND cm.rw_role = 'admin'
          AND cm.rw_is_active = TRUE
    )
);
-- El UPDATE en channel_members solo se usa para soft delete
-- Solo el propio usuario puede salir, solo un admin puede remover a otro
CREATE POLICY rw_channel_members_update ON rw_channel_members FOR UPDATE TO rw_app
USING (
    rw_user_id = current_setting('app.current_user_id')::uuid
    OR EXISTS (
        SELECT 1 FROM rw_channel_members cm
        WHERE cm.rw_channel_id = rw_channel_members.rw_channel_id
          AND cm.rw_user_id = current_setting('app.current_user_id')::uuid
          AND cm.rw_role = 'admin'
          AND cm.rw_is_active = TRUE
    )
);
```

**`rw_users` — UPDATE (RLS, sin INSERT directo según D-09):**
```sql
CREATE POLICY rw_users_update ON rw_users FOR UPDATE TO rw_app
USING (
    rw_id = current_setting('app.current_user_id')::uuid
    OR EXISTS (
        SELECT 1 FROM rw_users
        WHERE rw_id = current_setting('app.current_user_id')::uuid
          AND rw_role = 'admin'
          AND rw_deleted_at IS NULL
    )
);
-- Solo el propio usuario o un admin activo puede modificar un usuario
```

> **Reconciliación con D-09:** Las tablas marcadas como `controlado` en la matriz (`rw_users INSERT`, `rw_copilot_usage INSERT`) no tienen política RLS de INSERT porque `rw_app` no tiene el privilege de INSERT directo en esas tablas. Las operaciones pasan por stored procedures SECURITY DEFINER.

---

### Capa 4 — Triggers de integridad y auditoría

Los triggers actúan en la DB sin intervención del backend.

**Trigger anti-undeletion — `trg_rw_prevent_undeletion`:**
```sql
-- Una fila eliminada lógicamente no puede volver a estar activa
CREATE OR REPLACE FUNCTION rw_fn_prevent_undeletion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.rw_deleted_at IS NOT NULL AND NEW.rw_deleted_at IS NULL THEN
        RAISE EXCEPTION 'Cannot restore a soft-deleted record: %', OLD.rw_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rw_users_prevent_undeletion
    BEFORE UPDATE ON rw_users
    FOR EACH ROW EXECUTE FUNCTION rw_fn_prevent_undeletion();

CREATE TRIGGER trg_rw_messages_prevent_undeletion
    BEFORE UPDATE ON rw_messages
    FOR EACH ROW EXECUTE FUNCTION rw_fn_prevent_undeletion();
```

**Trigger de auditoría — accesos al copiloto:**
```sql
-- Registra en rw_copilot_usage automáticamente; el backend no puede omitirlo
-- Si el backend llama a rw_fn_search_authorized_messages, el trigger registra qué IDs fueron accedidos
```

**Trigger de actualización de timestamp — `trg_rw_set_updated_at`:**
```sql
-- Garantiza que rw_updated_at siempre refleja la última modificación real
-- El backend no necesita recordar enviarlo; la DB lo enforcea
CREATE OR REPLACE FUNCTION rw_fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.rw_updated_at = NOW();
    RETURN NEW;
END;
$$;
-- Aplicado en rw_users, rw_channels, rw_messages
```

---

### Verificación de independencia (Tests directos a la DB)

Estos tests prueban las cuatro capas sin ejecutar el backend:

| Test | Capa verificada | Resultado esperado |
|---|---|---|
| `DELETE FROM rw_messages` con rol `rw_app` | Privilege (Capa 2) | `ERROR: permission denied` |
| `UPDATE rw_messages SET rw_deleted_at = NULL WHERE rw_deleted_at IS NOT NULL` | Trigger (Capa 4) | `ERROR: Cannot restore a soft-deleted record` |
| `UPDATE rw_messages SET rw_is_active = FALSE, rw_deleted_at = NULL` | CHECK (Capa 1) | `ERROR: check constraint violated` |
| `INSERT INTO rw_messages (rw_author_id=otro_user, ...)` | RLS INSERT (Capa 3) | `ERROR: new row violates row-level security policy` |
| `UPDATE rw_messages SET rw_content = '...' WHERE rw_author_id != current_user` | RLS UPDATE (Capa 3) | `0 rows updated` (RLS silencioso) |
| `SELECT FROM rw_messages` en canal privado sin membresía | RLS SELECT (Capa 3) | `0 rows` |
| `INSERT INTO rw_users (rw_role = 'superadmin')` | CHECK (Capa 1) | `ERROR: check constraint violated` |
| `INSERT INTO rw_messages (rw_content = '   ')` | CHECK (Capa 1) | `ERROR: check constraint violated` |

**Consecuencia:**  
El backend puede simplificarse a su mínima expresión: abrir transacción, propagar `app.current_user_id`, ejecutar la query o stored procedure, cerrar transacción. PostgreSQL hace el resto.


---

## D-14 — WebSocket con STOMP para mensajería en tiempo real

**Contexto:**  
La mensajería interna debe ser sincrónica: cuando un usuario envía un mensaje, los demás miembros del canal deben recibirlo sin necesidad de recargar ni hacer polling. El backend ya expone REST para historial y CRUD; se necesita un canal persistente para entrega en tiempo real.

**Decisión:**  
Spring Boot + STOMP sobre WebSocket (`spring-websocket` + `spring-messaging`).

- Los clientes se conectan una sola vez y mantienen la conexión abierta.
- Se suscriben a topics por canal: `/topic/channels/{channelId}`.
- Cuando un mensaje se inserta exitosamente vía `POST /api/channels/{id}/messages`, el backend lo publica al topic correspondiente.
- Los suscriptores autorizados lo reciben en tiempo real sin nueva request HTTP.

**Alternativas descartadas:**

| Alternativa | Razón del descarte |
|---|---|
| Polling periódico (REST cada N segundos) | Latencia artificial, carga innecesaria en DB, no es tiempo real. |
| Server-Sent Events (SSE) | Unidireccional del servidor al cliente. No soporta el protocolo de subscripción por canal de forma natural. |
| WebSocket puro sin STOMP | Requiere protocolo custom de routing, subscripción y error handling. STOMP ya resuelve eso y Spring Boot lo soporta nativamente. |

**Razón:**  
STOMP es un protocolo ligero de mensajería sobre WebSocket con soporte nativo en Spring Boot (`@MessageMapping`, `SimpMessagingTemplate`). Su modelo de topics (`/topic/...`) se alinea naturalmente con el concepto de canales del sistema. La integración con el flujo REST existente es mínima: un solo `messagingTemplate.convertAndSend(...)` después del INSERT exitoso.

---

### Arquitectura WebSocket

```
Cliente A (miembro del canal)           Cliente B (miembro del canal)
        |                                       |
        |-- HTTP Handshake + JWT ---------> Spring WebSocket Endpoint
        |<-- Upgrade: websocket -----------|
        |                                       |
        |-- SUBSCRIBE /topic/channels/X ---|   |-- SUBSCRIBE /topic/channels/X
        |                                       |
        |-- POST /api/channels/X/messages  |   |
              (REST, con JWT)                   |
                    |                           |
              [Spring inserta en DB]            |
                    |                           |
              [SimpMessagingTemplate]           |
                    |-- broadcast /topic/channels/X --> Cliente A y Cliente B
```

---

### Seguridad en WebSocket

**Autenticación — una sola vez en el handshake:**
```java
// ChannelInterceptor valida el JWT en el frame CONNECT
// El user_id queda almacenado en el Principal del WebSocket session
// No se valida en cada mensaje — el handshake ya autenticó
```

**Autorización — al momento de la suscripción:**
```java
// Al recibir SUBSCRIBE /topic/channels/{channelId}
// Verificar que el user_id (del Principal) es miembro del canal
// Si no es miembro: lanzar excepción → cliente recibe error y no se suscribe
// La DB sigue siendo la fuente de verdad para esta verificación
```

**Invariante de seguridad:**  
Un usuario que es expulsado de un canal no recibe mensajes nuevos porque su suscripción se invalida. Los mensajes históricos siguen protegidos por RLS en las queries REST.

---

### Coexistencia REST + WebSocket

| Operación | Canal | Razón |
|---|---|---|
| Cargar historial de mensajes | REST + Keyset Pagination | El historial no es tiempo real; keyset garantiza orden y eficiencia. |
| Enviar un mensaje | REST `POST /api/channels/{id}/messages` | El INSERT a la DB debe ser transaccional y pasar por RLS. |
| Recibir mensajes nuevos | WebSocket STOMP topic | Entrega en tiempo real sin polling. |
| Buscar mensajes | REST `GET /api/messages/search` | Full-text search con `ts_headline` es una query puntual. |
| Consultar Copiloto | REST `POST /api/copilot/query` | El flujo RAG es síncrono por naturaleza (embedding → DB → LLM). |

**Flujo de envío completo:**
1. Cliente envía `POST /api/channels/{id}/messages` con JWT.
2. Backend valida JWT, abre transacción, llama `SET LOCAL app.current_user_id`.
3. DB inserta en `rw_messages` bajo RLS (INSERT policy verifica membresía y autoría).
4. Si el INSERT es exitoso: `messagingTemplate.convertAndSend("/topic/channels/{id}", messageDto)`.
5. Todos los clientes suscritos al topic reciben el mensaje inmediatamente.
6. Si el INSERT falla: no se publica nada. El cliente recibe el error HTTP.

---

### Cambios en el frontend (React)

- Conectar con `@stomp/stompjs` + `sockjs-client` en el montaje del componente de conversación.
- El JWT se envía en el header del handshake, no en cada mensaje.
- Al recibir un mensaje por WebSocket, se agrega directamente al estado local sin recargar historial.
- Si la conexión se pierde: mostrar indicador de reconexión y reintentar con backoff.

**Estados de conexión WebSocket en UI:**

| Estado | Visualización |
|---|---|
| `CONNECTING` | Indicador de carga discreta |
| `CONNECTED` | Normal — mensajes en tiempo real |
| `DISCONNECTED` | Banner de advertencia + botón de reintentar |
| `ERROR` | Mensaje de error + fallback a polling manual |

**Consecuencia:**  
El MVP tiene mensajería en tiempo real con una conexión persistente por pestaña del navegador. La adición al backend es mínima: un endpoint de WebSocket, un interceptor de JWT, un interceptor de suscripción, y un `convertAndSend` tras cada INSERT exitoso.


---

## D-15 — `EmbeddingProvider` como interfaz separada de `AiProvider`

**Contexto:**  
El sistema necesita dos capacidades de IA distintas: generar embeddings vectoriales de texto (para indexar mensajes y queries) y generar respuestas de lenguaje natural (para el copiloto). Actualmente D-11 documenta `AiProvider` para completions. La pregunta es si la generación de embeddings debe ser parte de esa misma interfaz o una separada.

**Decisión:**  
Dos interfaces independientes e intercambiables:

```java
// Genera vectores numéricos a partir de texto
// Implementaciones: OpenAiEmbeddingProvider, MockEmbeddingProvider
public interface EmbeddingProvider {
    float[] embed(String text);
}

// Genera respuestas de lenguaje natural con contexto
// Implementaciones: OpenAiProvider, AnthropicProvider, MockAiProvider
public interface AiProvider {
    String generateCompletion(String systemPrompt, String context, String query);
}
```

**Alternativa descartada:**  
Un único `AiProvider` con ambos métodos: `embed(text)` y `generateCompletion(...)`.

**Razón:**  

| Dimensión | `AiProvider` (completions) | `EmbeddingProvider` |
|---|---|---|
| **Costo por llamada** | Alto (tokens de entrada y salida) | Bajo (solo tokens de entrada) |
| **Velocidad** | Lenta (streaming opcional) | Rápida (respuesta directa) |
| **Determinismo** | No determinístico (temperatura) | Determinístico para el mismo texto |
| **Caché viable** | No (respuestas únicas por contexto) | Sí (mismo texto → mismo vector) |
| **Modelo típico** | GPT-4, Claude, Gemini Pro | text-embedding-ada-002, sentence-transformers |

Estos perfiles son tan distintos que en producción es común usar proveedores diferentes: embeddings con `text-embedding-ada-002` de OpenAI (barato y estable) y completions con Claude o Gemini (mejor razonamiento). Si la interfaz es única, cambiar el modelo de embeddings obliga a tocar la lógica de completions y viceversa. Fusionarlas violaría el principio de segregación de interfaces (SOLID-ISP).

Adicionalmente, el ciclo de vida de cada una es distinto:
- Los embeddings se generan al **insertar mensajes** (en el flujo de escritura, fuera de la transacción principal).
- Las completions se generan solo al **consultar el copiloto** (en el flujo de lectura autorizada).

Mantenerlas separadas permite:
- **Mock independiente en tests:** el test del flujo RAG puede usar `MockEmbeddingProvider` sin afectar la validación del `MockAiProvider`.
- **Swap independiente en producción:** cambiar de `text-embedding-ada-002` a un modelo local no toca nada de la lógica del copiloto.

---

### Tres interfaces del ecosistema de IA

El sistema tiene tres interfaces distintas en la capa de infraestructura de IA:

| Interface | Responsabilidad | Consumida por |
|---|---|---|
| `EmbeddingProvider` | Generar `float[]` a partir de texto | `EmbeddingService` al insertar/editar mensajes |
| `EmbeddingRepository` | Almacenar y consultar vectores en el vector store | `EmbeddingService` (escritura) y copilot use case (lectura) |
| `AiProvider` | Generar texto de respuesta con contexto | Copilot use case tras obtener mensajes autorizados de la DB |

`EmbeddingProvider` y `EmbeddingRepository` son independientes: el primero es el motor que crea el vector, el segundo es el almacén donde vive. Esto permite usar pgvector como store con OpenAI como motor, o Qdrant como store con sentence-transformers como motor.

---

**Consecuencia:**  
El backend tiene cuatro componentes de infraestructura intercambiables de forma independiente:
1. `EmbeddingProvider` — seleccionado por variable de entorno `EMBEDDING_PROVIDER`.
2. `EmbeddingRepository` — implementación con pgvector para MVP.
3. `AiProvider` — seleccionado por variable de entorno `AI_PROVIDER`.
4. `VectorStore` — abstracción del motor de búsqueda vectorial (coincide con `EmbeddingRepository` en MVP).

---

## D-16 — Proveedor de IA Google Gemini con Fallback Contextual Seguro

**Contexto:**  
El sistema eliminó completamente dependencias de OpenAI para utilizar Google Gemini (`gemini-1.5-flash` / `gemini-1.5-pro`). Se requiere garantizar que fallos de red, cuotas o credenciales externas jamás expongan errores técnicos, modelos o URLs al usuario final.

**Decisión:**  
`GeminiProvider.java` implementa `AiProvider`. Incluye normalización automática del identificador del modelo y un mecanismo de síntesis contextual de fallback seguro en servidor:
- Si la API externa de Gemini responde exitosamente, devuelve la respuesta generada.
- Si la API externa falla (HTTP 404, 403, 429, timeout o credencial no configurada), el servidor intercepta el error y genera una síntesis limpia y profesional basada en los puntos autorizados recuperados de PostgreSQL RLS.
- En ningún caso se propagan códigos HTTP, identificadores de modelos (`models/gemini...`) o stack traces al frontend.

**Alternativa descartada:**  
Propagar mensajes de error crudos de la API externa al usuario.

**Razón:**  
Filtrar detalles técnicos de APIs externas es una vulnerabilidad de seguridad e información (Information Leakage). La experiencia de usuario debe mantenerse funcional, profesional y contextualizada a partir de los datos que la base de datos ya autorizó y recuperó.

---

## D-17 — Orden Cronológico Ascendente en UI y Paginación Keyset Inversa

**Contexto:**  
En PostgreSQL, la consulta de Keyset Pagination más eficiente para obtener los últimos N mensajes se ejecuta con `ORDER BY rw_created_at DESC, rw_id DESC LIMIT N`. Si el frontend renderiza el array recibido directamente, los mensajes más recientes aparecen arriba y los más antiguos abajo, invirtiendo la lectura natural de un chat.

**Decisión:**  
1. El backend entrega la página en orden descendente (`rw_created_at DESC`) para aprovechar el índice B-Tree Keyset.
2. Al recibir la respuesta en el frontend, el array se invierte inmediatamente (`[...history].reverse()`) para mostrar los mensajes cronológicamente de arriba (antiguos) a abajo (nuevos), desplazando el scroll automáticamente al final.
3. Al paginar hacia atrás (mensajes anteriores), el cursor toma el primer elemento visible `messages[0]` (`(cursor_created_at, cursor_id)`), invierte el nuevo lote y lo antepone al inicio de la lista (`[...olderAsc, ...prev]`).

**Alternativa descartada:**  
Hacer subqueries `SELECT * FROM (SELECT ... ORDER BY DESC LIMIT N) ORDER BY ASC` en la base de datos para cada petición.

**Razón:**  
Mantener la query del backend simple y pura en DESC maximiza el uso del índice sin procesamiento adicional en PostgreSQL. La inversión en memoria en React tiene costo computacional despreciable O(N) para 30 elementos.

---

## D-18 — Aislamiento Atómico de Estado de Sesión y Canal

**Contexto:**  
Al cambiar de usuario (logout/login) o al cambiar de canal activo, existía riesgo de que mensajes o historiales de la conversación previa se mantuvieran en pantalla mientras cargaba la nueva petición de red.

**Decisión:**  
1. **Cambio de Canal:** `App.jsx` ejecuta `setMessages([])` y `setIsLoadingHistory(true)` inmediatamente al seleccionar un nuevo canal, antes de disparar la petición HTTP.
2. **Cambio de Sesión:** `App.jsx` vigila el cambio de `user?.id`. Si el ID del usuario cambia o la sesión se cierra, purga atómicamente todos los estados en memoria (`copilotHistory = []`, `messages = []`, `channels = []`, `activeChannel = null`, `usageStats = null`) y cierra el socket WebSocket.

**Alternativa descartada:**  
Permitir que el estado viejo permanezca como "placeholder" mientras responde la API.

**Razón:**  
El aislamiento estricto de datos es un requerimiento mandatorio de privacidad y Row Level Security (RLS). Ningún usuario debe percibir visualmente mensajes de otro usuario o de otro canal durante transiciones de interfaz.

---

## D-19 — De-duplicación Atómica de Mensajes Optimistas vs WebSocket

**Contexto:**  
Al enviar un mensaje en el frontend, se agrega una entrada optimista provisional (`status: 'pending'`, `rw_id: 'temp_...'`). El backend inserta en PostgreSQL y casi simultáneamente emite el mensaje confirmado por WebSocket STOMP (`/topic/channels/{channelId}`). Si el mensaje de WebSocket llega antes de que la promesa HTTP resuelva, se producía una duplicación visual temporal del mensaje.

**Decisión:**  
1. En el listener de WebSocket: se busca si existe un mensaje con `status === 'pending'`, mismo `rw_content` y mismo `rw_author_id`. Si existe, se reemplaza en el mismo índice con el mensaje confirmado (`status: 'sent'`).
2. En el callback de `api.sendMessage`: se verifica si el ID real ya fue insertado por el WebSocket; si es así, se remueve el temporal residual sin volver a agregarlo.

**Alternativa descartada:**  
Desactivar la UI optimista y esperar siempre a que responda el WebSocket o HTTP.

**Razón:**  
La interfaz optimista provee respuesta táctil inmediata al usuario (estilo WhatsApp). La reconciliación bidireccional por contenido y autor elimina cualquier race condition entre el broadcast del socket y la respuesta REST.

---

## D-20 — Visibilidad Global de Supervisión para Administradores de Plataforma

**Contexto:**  
Los administradores de la organización (`admin@riwi.io`, `alejandro.lead@riwi.io`) requieren supervisar y auditar todas las conversaciones de la plataforma (incluyendo canales privados) para control de cumplimiento, retención de talento y auditoría interna.

**Decisión:**  
1. Se creó la función helper `rw_fn_is_admin(p_user_id UUID)` en PostgreSQL con `SECURITY DEFINER`.
2. Se actualizaron las políticas RLS (`rw_channels_select/update`, `rw_messages_select`, `rw_channel_members_select/insert/update`, `rw_vw_user_conversations` y `rw_fn_search_authorized_messages`) para incluir:
   ```sql
   OR rw_fn_is_admin(NULLIF(current_setting('app.current_user_id', true), '')::uuid)
   ```
3. El interceptor de WebSocket `SubscriptionInterceptor.java` valida que los administradores tengan autorización automática para suscribirse a cualquier topic de canal.

**Alternativa descartada:**  
Dar privilege `BYPASSRLS` al usuario de base de datos `rw_app`.

**Razón:**  
El usuario de base de datos `rw_app` debe mantener `NOBYPASSRLS` estricto (D-09, D-13). La autorización del administrador se evalúa a nivel de fila mediante políticas RLS con `app.current_user_id`, preservando el principio de menor privilegio y la separación entre la identidad del sistema y la identidad del usuario.

---

## D-21 — Invitación Dinámica a Grupos Privados y Permisos de Gestión

**Contexto:**  
En canales privados creados por usuarios (ej. `#proyecto-frontend`), se requiere permitir que los creadores y administradores del canal inviten a otros compañeros de cohorte/organización de forma ágil, visualizándose inmediatamente en sus listas de chat.

**Decisión:**  
1. Endpoints REST `GET /api/channels/{channelId}/members` y `POST /api/channels/{channelId}/members`.
2. Al crear un canal, el creador se registra en `rw_channel_members` con `rw_role = 'admin'` para ese canal.
3. La política RLS `rw_channel_members_insert` permite la inserción de nuevos miembros si el solicitante es admin del canal, miembro del canal o admin del sistema.
4. Si un usuario ya había pertenecido y fue retirado, la inserción realiza un `ON CONFLICT DO UPDATE SET rw_is_active = TRUE, rw_deleted_at = NULL` reactivando la membresía de forma segura y consistente con D-02.
5. El frontend ofrece un modal interactivo con avatares y buscador de usuarios para agregar miembros con un solo clic.

**Alternativa descartada:**  
Manejo de membresías mediante edición directa de tablas sin validación de RLS ni reactivación de soft delete.

**Razón:**  
Garantiza integridad referencial, respeto al histórico de miembros y sincronización en tiempo real de las conversaciones autorizadas.

---

## D-22 — Paneles Colapsables y Búsqueda Full-Text Integrada

**Contexto:**  
En pantallas de escritorio o móviles, una interfaz fija de 3 columnas puede saturar el espacio de trabajo. Los usuarios requieren concentrarse exclusivamente en el chat (modo pantalla completa), ocultar o mostrar la lista de canales (Zona 1) y el asistente Copilot IA (Zona 3) según su necesidad, además de poder buscar rápidamente dentro del contenido de todos sus mensajes autorizados.

**Decisión:**  
1. **Paneles Colapsables:** Estados booleanos reactivos `showChannels` y `showCopilot` controlados desde el header mediante botones con iconos (`PanelLeft`, `Sparkles`). El área central de chat (`ZoneChat`) usa `flex-1` expandiéndose dinámicamente hasta el 100% del ancho disponible cuando ambos paneles laterales están ocultos.
2. **Pestaña de Búsqueda Full-Text:** Se agregó la pestaña **"Mensajes"** en `ZoneConversations.jsx` que consume el endpoint `GET /api/messages/search?q=` de PostgreSQL con resaltado `ts_headline`, permitiendo al usuario buscar términos en todos sus canales autorizados bajo RLS y saltar directamente al canal y mensaje seleccionado.

**Alternativa descartada:**  
Layout estático con columnas de ancho fijo o modales flotantes intrusivos.

**Razón:**  
Brinda máxima ergonomía, adaptabilidad multidispositivo y acceso inmediato tanto a la búsqueda de canales como a la búsqueda profunda de mensajes históricos.

---

## D-23 — Guardrails de Relevancia RAG, Límite Estricto de 2 Citas y Flag `answer_found`

**Contexto:**  
En sistemas RAG con retrieval híbrido, si el modelo recibe múltiples fragmentos candidatos o si la consulta del usuario no tiene respuesta en el contexto autorizado (preguntas matemáticas, generales o sobre conversaciones no autorizadas), existía el riesgo de que la IA alucinara respuestas combinando fragmentos irrelevantes o devolviera una cantidad excesiva de citas (más de 5).

**Decisión:**  
1. **Límite Estricto de Citas:** El backend `CopilotController.java` acota rigurosamente las citas devueltas a un **máximo de 2 fragmentos** (`Math.min(2, citations.size())`), seleccionando exclusivamente los fragmentos pertinentes que respaldan la respuesta generada.
2. **Guardrail Anti-Alucinación y Validación de Relevancia:** Antes de generar respuesta, el motor evalúa si los fragmentos autorizados contienen información que responda directamente la pregunta. Si no hay correspondencia directa (o se solicitan operaciones matemáticas/generales fuera de contexto), el sistema responde invariablemente:  
   `"⚠️ No encontré esa información en los canales autorizados."` con `citations = []`.
3. **Flag Booleano `answer_found`:** El endpoint `/api/copilot/query` expone el atributo `answer_found (boolean)`. El frontend en `ZoneCopilot.jsx` detecta este indicador y renderiza las respuestas no encontradas en un cuadro de advertencia destacado con icono `AlertTriangle`, evitando mostrar citas erróneas.
4. **Flujo Cronológico:** Las preguntas y respuestas del Copiloto se agregan al final de la lista con auto-scroll fluido, manteniendo la naturalidad de lectura secuencial.

**Alternativa descartada:**  
Permitir que el LLM intente responder libremente con conocimientos generales o devolver todas las citas recuperadas en la búsqueda vectorial sin post-filtrado.

**Razón:**  
Garantiza integridad corporativa, evita desinformación o alucinaciones y refuerza el aislamiento de seguridad RLS ante consultas no autorizadas.




