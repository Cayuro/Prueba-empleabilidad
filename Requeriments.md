# Prueba Técnica: Plataforma Interna de Mensajería con IA (Riwi Co. S.A.S.)

## Propósito
El propósito de esta prueba técnica es evaluar la capacidad del coder para construir una solución fullstack profesional basada en una plataforma interna de mensajería, integrando base de datos relacional, backend, frontend, autenticación, seguridad a nivel de datos e inteligencia artificial con recuperación aumentada por contexto (RAG). 

La prueba busca evidenciar:
* Análisis de negocio.
* Normalización hasta 3FN.
* Lógica crítica dentro de PostgreSQL.
* Arquitectura limpia.
* Experiencia de usuario responsiva.
* Un copiloto de IA que responda únicamente con información permitida para el usuario autenticado.

---

## Descripción del Proyecto
**Riwi Co. S.A.S.** requiere modernizar su comunicación interna mediante una plataforma de mensajería organizada, segura y consistente. El sistema debe administrar usuarios, mensajes, estados de lectura, búsqueda de conversaciones y consultas a un copiloto de IA. Adicionalmente, los mensajes deben poderse eliminar o editar conservando sus estados originales en caso de fallo. 

> **Requisito no negociable:** Ningún usuario puede leer, buscar o consultar mediante el copiloto contenido al que no tiene acceso.

---

## Requerimientos Técnicos

### 1. Análisis, normalización y modelo de datos
* Construir un **Modelo Entidad Relación** con entidades, atributos, claves primarias, claves foráneas, cardinalidades y justificación del tipo de clave elegido.
* Crear un corpus `seed.json` que identifique entidades, relaciones y reglas de negocio implícitas, y documente el proceso de normalización hasta Primera, Segunda y Tercera Forma Normal (3FN).

### 2. Implementación de base de datos en PostgreSQL
* Implementar una base de datos **PostgreSQL 15 o superior** con nombre `bd_nombre_apellido_clan`.
* Todos los nombres de tablas y columnas deben estar en **inglés e iniciar con el prefijo `rw_`**.
* Incluir **DDL completo**, PK, FK con `ON DELETE` explícito y justificado, `UNIQUE`, al menos un **índice único parcial**, `NOT NULL`, `CHECK` y fechas `timestamptz` en UTC.

### 3. Lógica de negocio en la base de datos
* Implementar **funciones transaccionales**, garantizando que los permisos se validen en la base de datos y que no existan rastros parciales ante errores.
* Activar **Row Level Security (RLS)** sobre canales y mensajes, usando un rol de aplicación sin `BYPASSRLS` y un actor fijado por transacción mediante `app.current_user_id`.
* Crear la **vista de conversaciones** del usuario.
* Crear mínimo **dos procedimientos almacenados**: consulta de usuarios y un procedimiento para la edición y eliminación de usuarios.

### 4. Búsqueda, recuperación de contexto y seguridad
* Delimitar la forma en la cual el copiloto debe recuperar los mensajes de cada usuario. No debe tener acceso a los mensajes globales, **únicamente a los canales donde el actor es miembro**.
* Usar una base vectorial para guardar los mensajes y un motor de embeddings para recuperarlos con el LLM.
* Incorporar al menos **un trigger** para mantener el vector de búsqueda consistente.
* Se prohíbe terminantemente:
  * El borrado físico de mensajes.
  * El SQL por concatenación.
  * La paginación con `OFFSET`.

### 5. Backend y API REST
* Aplicar **Clean Architecture** con capas explícitas y dependencias apuntando al dominio (el dominio no debe depender del framework web ni del driver de base de datos).
* Implementar **casos de uso delgados** que validen entrada, invoquen funciones de base de datos y mapeen resultados.
* Incluir **principios SOLID** demostrables en el código y evaluar si es necesario aplicar un patrón de diseño (en caso de aplicarlo, justificarlo correctamente).
* Exponer una **API REST** con códigos de estado correctos, manejo uniforme de errores, identificador de correlación y **paginación por keyset**.

### 6. Autenticación y autorización
* Implementar inicio de sesión con usuarios, verificando contraseñas contra un **hash seguro**.
* Usar **JWT** con token de acceso de vida corta y *refresh token* con rotación, almacenado de forma segura.
* Proteger las rutas y tomar el identificador del usuario **exclusivamente del token**, nunca del cuerpo de la petición.
* Propagar el actor autenticado a las funciones de base de datos y a las políticas RLS.

### 7. Frontend
* Construir una interfaz con mínimo tres zonas: **conversación, panel del copiloto y perfil de usuario**.
* Permitir el envío de mensajes con estados: **pendiente, enviado y fallido**.
* Implementar **carga de historial de forma diferida** preservando la posición del scroll, estados de carga, vacío y error.
* La interfaz debe ser **responsiva** (móvil y escritorio), estar disponible en **español e inglés**, y evitar cadenas incrustadas (*hardcoded*) en componentes.

### 8. Copiloto de IA
* Integrar un copiloto de IA con enfoque **RAG**, recuperando contexto exclusivamente perteneciente al actor que lo esté usando.
* Cada respuesta debe incluir **citas a los mensajes fuente** y responder con honestidad cuando no exista contexto suficiente.
* El copiloto debe conocer al usuario autenticado (nombre y cargo), construyendo ese contexto en el servidor desde el token.
* El proveedor de IA debe ser intercambiable entre diferentes proveedores eligiendo una interfaz específica (ej. OpenAI SDK).
* El *system prompt* debe estar versionado, el contenido de chats debe tratarse como dato no confiable y deben existir **negativas explícitas** por falta de permisos, fuera de alcance o contexto insuficiente.

### 9. QA, evidencias y extras
* Incluir mínimo **dos pruebas automatizadas contra PostgreSQL real**: 
  1. Verificar que se rechaza a un usuario no miembro.
  2. Confirmar que no se retornan mensajes de canales privados ajenos.

### 10. Despliegue
* `docker compose up` debe levantar la base de datos, el backend y el frontend.
* Debe existir un **comando documentado** para ejecutar migraciones y cargar el corpus completo.
* Incluir un archivo `.env.example` sin secretos reales y verificar que el proyecto pueda levantarse en una máquina limpia siguiendo únicamente el `README.md`.

### 11. Consultas y funciones SQL requeridas
* **Consulta 1:** Historial de mensajes de un canal con paginación por keyset.
* **Consulta 2:** Búsqueda de mensajes con resaltado del término encontrado.
* **Consulta 3:** Recuperación de contexto para el copiloto con permisos en SQL.
* **Consulta 4:** Consumo acumulado del copiloto por usuario.

---

## Entregables
* Script DDL, scripts de carga, scripts DML, consultas SQL, funciones, triggers, vistas, procedimientos y políticas RLS.
* Modelo Entidad Relación en PDF o imagen, `seed.json` original y archivos utilizados para representar la solución.
* Documentación de API mediante Swagger/OpenAPI publicado o colección Postman exportada.
* Archivos: `README.md`, `ARCHITECTURE.md`, `DECISIONS.md`, evidencias de ejecución y URL del repositorio.

---

## Criterios de Aceptación y Condiciones de Invalidación

### Criterios de Aceptación
* El modelo representa correctamente el negocio y llega hasta **3FN**.
* La lógica crítica vive en PostgreSQL mediante transacciones, restricciones, RLS, funciones, vistas y procedimientos.
* La carga del corpus funciona correctamente.
* La API, autenticación JWT, frontend responsivo, internacionalización y copiloto funcionan de punta a punta.
* La mensajería debe funcionar en tiempo real.

### Condiciones que Invalidan la Prueba
* Las contraseñas quedan almacenadas en texto plano.
* El primer commit contiene lógica previa al inicio de la jornada.
* El coder no puede explicar el código entregado o el repositorio deriva de una aplicación de mensajería existente.