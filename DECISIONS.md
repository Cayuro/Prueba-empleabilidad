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
CONSTRAINT chk_rw_users_active    CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_channels_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_messages_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
```

**Alternativa descartada:**  
Solo `rw_deleted_at`, eliminando `rw_is_active`.

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
El cliente debe implementar lógica de renovación automática antes de los 15 minutos o al recibir un `401`. El backend no necesita un endpoint de logout con invalidación activa; el token expira naturalmente.

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
CONSTRAINT chk_rw_users_active    CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_channels_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
CONSTRAINT chk_rw_messages_active CHECK (rw_is_active = (rw_deleted_at IS NULL))
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

**`rw_users` — UPDATE:**
```sql
CREATE POLICY rw_users_update ON rw_users FOR UPDATE TO rw_app
USING (
    rw_id = current_setting('app.current_user_id')::uuid
    OR EXISTS (
        SELECT 1 FROM rw_users
        WHERE rw_id = current_setting('app.current_user_id')::uuid
          AND rw_role = 'admin'
    )
);
-- Solo el propio usuario o un admin puede modificar un usuario
```

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

