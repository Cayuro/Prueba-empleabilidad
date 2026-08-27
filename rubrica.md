Base de Datos y PostgreSQL	
No hay entrega
0 puntos
No entrega un corpus ni un modelo verificable. La normalización es ausente o incorrecta; la base carece de PK/FK o restricciones críticas. No implementa las consultas requeridas ni controles de acceso en la base; los usuarios pueden consultar información ajena.
4 puntos
Propone entidades y una base parcialmente funcional, pero presenta inconsistencias en 3FN, cardinalidades o restricciones. Faltan consultas relevantes y la RLS es parcial, usa un rol privilegiado o no fija correctamente el actor por transacción.
8 puntos
Implementa un modelo coherente en 3FN y una base funcional con DDL, PK/FK, restricciones, timestamptz e índices. Incluye la mayoría de funciones y consultas, y aplica RLS en los recursos principales, con detalles menores en políticas o alcance.
12 puntos
Integra scripts reproducibles, restricciones completas, transacciones atómicas, vistas, procedimientos, soft delete, búsqueda y paginación keyset. Configura rol sin BYPASSRLS, actor por transacción y políticas consistentes que demuestran aislamiento de datos.
16 puntos
Optimiza una solución robusta, mantenible e idempotente. Afina consultas e índices con evidencia, aplica mínimo privilegio, auditoría y pruebas adversariales de RLS. Documenta la relación entre reglas de negocio, integridad, rendimiento y seguridad.
20 puntos
Backend, API y Arquitectura	
No hay entrega
0 puntos
Entrega código monolítico o inestable; la API no cubre el MVP ni controla errores. No implementa autenticación efectiva, almacena contraseñas de forma insegura, confía en identificadores enviados por el cliente o deja rutas críticas abiertas.
4 puntos
Separa algunas capas y expone endpoints básicos, pero mezcla responsabilidades. Login, JWT, refresh token, validaciones, errores, paginación, documentación o tiempo real son incompletos y existen controles de autorización inconsistentes.
8 puntos
Implementa dominio separado, casos de uso y API REST operativa. Usa hash seguro, JWT, actor derivado del token y rutas protegidas. Los códigos, errores, keyset, documentación y mensajería funcionan, con detalles menores en rotación o revocación.
12 puntos
Integra Clean Architecture de forma consistente, contratos claros, validación, errores uniformes, correlation ID, Swagger/OpenAPI y tiempo real estable. Asegura access token corto, refresh token rotado y protegido, autorización consistente y evita SQL concatenado.
16 puntos
Optimiza una arquitectura desacoplada, testeable y resiliente. Añade revocación, auditoría, mínimo privilegio, observabilidad y pruebas adversariales de autenticación y autorización, manteniendo trazabilidad y consistencia ante concurrencia, errores y reconexiones.
20 puntos
Frontend y Experiencia Fullstack	
No hay entrega
0 puntos
No entrega una interfaz utilizable o los flujos principales están rotos. Faltan conversación, perfil o copiloto; no hay protección de rutas, el manejo de sesión expone información sensible o la experiencia falla en móvil y escritorio.
4 puntos
Construye pantallas básicas, pero varios flujos pierden estado o no manejan errores. El historial, scroll, búsqueda, responsividad, internacionalización, rutas protegidas o cierre y renovación de sesión son incompletos.
8 puntos
Implementa las tres zonas y los flujos esenciales de mensajería. Maneja estados de envío e interfaz, consume la API, funciona en móvil y escritorio y protege las rutas principales, con detalles menores en sesión, permisos o traducción.
12 puntos
Integra una experiencia coherente y responsiva con autenticación, rutas protegidas, renovación y cierre de sesión, conversación en tiempo real, búsqueda, historial sin saltos y feedback completo. No confía en permisos calculados solo en el cliente.
16 puntos
Perfecciona la UX con accesibilidad, rendimiento, recuperación segura ante fallos, expiración de sesión y reconexión. Demuestra pruebas de flujos críticos, permisos y ausencia de exposición de datos en distintos tamaños de pantalla.
20 puntos
Inteligencia Artificial y RAG	
No hay entrega
0 puntos
No integra un copiloto funcional o responde con contenido no autorizado, sin citas o inventando contexto. No limita la recuperación por usuario, confía en datos del cliente o expone información de canales ajenos.
4 puntos
Conecta un LLM o búsqueda vectorial de forma parcial, pero el contexto, las citas, las negativas o el aislamiento por usuario son inconsistentes. Los permisos se aplican tarde o no se demuestran con pruebas suficientes.
8 puntos
Implementa un RAG funcional con embeddings, recuperación por actor, citas y respuesta ante contexto insuficiente. El contexto se construye en servidor y se aplican permisos principales, con detalles menores en trazabilidad o protección de entradas.
12 puntos
Integra RAG seguro de punta a punta: permisos antes de recuperar, citas verificables, contexto del usuario construido en servidor, entradas tratadas como no confiables, negativas explícitas y proveedor intercambiable. Las pruebas contra PostgreSQL real demuestran aislamiento.
16 puntos
Optimiza precisión, seguridad y operabilidad mediante evaluación de recuperación, trazabilidad de fuentes, protección frente a prompt injection, mínimo privilegio y consumo medible por usuario. Demuestra con pruebas adversariales que ninguna consulta o prompt cruza permisos.
20 puntos
Exposición y Sustentación	
No hay entrega
0 puntos
No realiza la exposición o presenta información desorganizada que no permite comprender ni validar la solución. No demuestra el MVP, no sustenta decisiones y no responde preguntas fundamentales.
4 puntos
Expone parcialmente el problema y la solución, pero la narrativa, la demostración o las evidencias son incompletas. Justifica pocas decisiones y responde con inseguridad o sin relacionar las respuestas con la implementación.
8 puntos
Presenta una exposición clara del problema, la arquitectura y los flujos principales. Demuestra el MVP y sustenta las decisiones más relevantes, aunque presenta detalles menores en evidencias, manejo del tiempo o profundidad de las respuestas.
12 puntos
Estructura una sustentación clara, concisa y convincente. Demuestra el MVP de punta a punta, conecta decisiones con requisitos y evidencias, reconoce riesgos y limitaciones, administra bien el tiempo y responde preguntas con dominio técnico.
16 puntos
Realiza una exposición sobresaliente con narrativa técnica y de negocio, demostración fluida, evidencias trazables y manejo preciso de preguntas. Comunica trade-offs, riesgos, métricas, aprendizajes y un pitch técnico-comercial convincente.
20 puntos
