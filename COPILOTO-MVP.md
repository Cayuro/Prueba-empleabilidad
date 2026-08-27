# Prueba de Copiloto — MVP

Estructura mínima creada por el SPEC inicial. Siguientes pasos:
- Implementar backend bootstrapping para aplicar `database/migrations/0001_init.sql` y cargar `database/seeds/seed.json`.
- Implementar adapters `AiProvider` y `EmbeddingRepository`.
 
Tech stack guidance
------------------
- Frontend: React (recommended Next.js for ease of routing and SSR if needed). Layered frontend architecture: `components`, `features`, `pages`, `services`, `i18n`.
- Backend: Node.js + TypeScript (Express or Fastify) with Clean Architecture layers (presentation, application, domain, infrastructure). Backend must be thin — orchestrator only — and delegate business rules and authorization to the database (smart database model).

Run notes
---------
Use `docker compose up` to boot services; the backend entrypoint should apply migrations and seeds automatically.
