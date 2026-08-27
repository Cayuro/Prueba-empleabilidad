# Riwi Internal Messaging Platform with AI Copilot
**Riwi Co. S.A.S. — Enterprise Communication Platform with RAG AI Assistance**  
**PostgreSQL 15+ (pgvector, RLS) • Spring Boot 3 (Java 17/21) • React 18 (Tailwind CSS)**

---

## 📌 Overview

The **Riwi Internal Messaging Platform** is a high-performance, real-time enterprise collaboration system built on the **Smart Database** paradigm. Security, authorization (Row Level Security), data integrity triggers, full-text bilingual search, and AI vector similarity (pgvector) are enforced directly within PostgreSQL 15+, while the Java backend acts as a thin orchestration service and the React frontend provides a responsive 3-zone layout with native dark/light theming and Spanish/English internationalization.

---

## 🚀 Quick Start Guide (Clean Machine Setup)

### 1. Prerequisites
Ensure the following tools are installed on your host system:
- **Docker Engine** (20.10+) and **Docker Compose** (v2.0+)
- *(Optional for local dev)* **Java 21 / Maven 3.8+**, **Node.js 18+ / npm 9+**, **PostgreSQL Client (`psql`)**

---

### 2. Environment Configuration
Copy the provided `.env.example` template:
```bash
cp .env.example .env
```
*(Default values in `.env.example` are pre-configured to work out-of-the-box with Docker Compose and Google Gemini)*.

---

### 3. Launch Services with Docker Compose
Start all containers (PostgreSQL 15 with pgvector, Spring Boot Backend, and React Frontend Nginx):
```bash
docker compose up -d --build
```

Check container status and health:
```bash
docker compose ps
```
The services will be available at:
- **Frontend SPA:** [http://localhost:3000](http://localhost:3000)
- **Backend REST API:** [http://localhost:8080](http://localhost:8080)
- **Swagger / OpenAPI 3.0 Documentation:** [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **STOMP WebSocket Endpoint:** `ws://localhost:8080/ws`

---

### 4. Load Seed Corpus Data
Migrations in `database/migrations/0001_init.sql` run automatically when the database initializes. To populate initial users, channels, sample messages, and embeddings:
```bash
bash database/load-seed.sh
```
*Or directly via Docker:*
```bash
docker exec -i rw_database psql -U postgres -d bd_juan_gomez_hamilton < database/seeds/load-seed.sql
```

---

## 🔑 Pre-configured Seed Credentials

| User Name | Email | Password | System Role | Channel Memberships | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Carlos Mendoza** | `admin@riwi.io` | `RiwiAdmin2026!` | `admin` | `#general`, `#desarrollo-dev`, `#liderazgo-privado` | Full admin & creator |
| **Valeria Gomez** | `valeria.dev@riwi.io` | `RiwiDev2026!` | `member` | `#general`, `#desarrollo-dev` | Dev Senior team |
| **Santiago Restrepo**| `santiago.coder@riwi.io`| `RiwiDev2026!` | `member` | `#general`, `#desarrollo-dev` | Restricted from private channel |
| **Mariana Torres** | `mariana.ai@riwi.io` | `RiwiDev2026!` | `member` | `#general`, `#desarrollo-dev` | Restricted from private channel |
| **Alejandro Castro** | `alejandro.lead@riwi.io` | `RiwiDev2026!` | `admin` | `#general`, `#desarrollo-dev`, `#liderazgo-privado` | Management team |

---

## 🧪 Automated Integration & Security Tests

### 1. Database Security & RLS Test Suite (PostgreSQL 15)
Run the automated integration test suite directly against PostgreSQL to validate all acceptance criteria:
```bash
bash tests/integration/test_runner.sh
```
*Tests verified: 8/8 PASSED (Non-member isolation, channel visibility, soft-delete triggers, NOBYPASSRLS permission denied, refresh token rotation, keyset cursor consistency, vector candidate RLS filter, idempotent read receipts).*

### 2. End-to-End REST API Test Suite (Spring Boot 3)
```bash
bash tests/e2e_api_test.sh
```
*Endpoints verified: 12/12 PASSED (User Registration, Token Refresh Rotation, Conversations List, Create Channel, Send Message, Keyset Pagination, Mark Read, Full-Text Search, Copilot RAG Query, Copilot Usage Audit, Soft Delete, Logout).*

---

## 💻 Manual Verification Workflow

### 1. Multi-Tenant Chat & RLS Isolation
1. Open [http://localhost:3000](http://localhost:3000) and login as **Santiago Restrepo** (`santiago.coder@riwi.io` / `RiwiDev2026!`).
2. Notice you can only see `#general` and `#desarrollo-dev`. The private channel `#liderazgo-privado` is invisible.
3. Open an Incognito window and login as **Carlos Mendoza** (`admin@riwi.io` / `RiwiAdmin2026!`).
4. Notice Carlos has access to `#liderazgo-privado`. Send a confidential message.
5. Verify in Santiago's session that the message never arrives and cannot be queried.

### 2. AI Copilot RAG Assistance & Citations
1. In the chat interface, navigate to **Zona 3 (Copilot Panel)**.
2. Ask: *"¿Cuál es la política de borrado de datos en la plataforma?"*
3. The Copilot will generate an answer synthesizing message context with citations `[CITA: message_uuid]`.
4. Ask a question regarding confidential leadership discussions while logged in as Santiago:
   - Notice the Copilot indicates lack of authorized context because RLS filtered out the private messages before the prompt reached the LLM.
5. Ask a math or generic out-of-scope question (`25 + 75` or `Capital de Francia`):
   - Notice the Copilot firmly rejects the query as insufficient authorized context.

### 3. UI Features (Theme, Language & User Registration)
- **User Registration:** Click on the "Registrarse" tab in the login modal to create an account and automatically join public channels.
- **Theme Toggle:** Click the 🌙 / ☀️ icon in the top header to toggle between Dark Mode and High-Contrast Orange/Black Light Mode.
- **Language Switcher:** Click the **ES / EN** button to instantly switch the interface language without page reloading.

---

## 📁 Repository Structure

```
├── ARCHITECTURE.md              # Clean architecture and sequence diagrams
├── README.md                    # Getting-started guide & test executions
├── docker-compose.yml           # Multi-container orchestration (DB, Backend, Frontend)
├── .env.example                 # Environment variables specification
├── credenciales_acceso.txt      # Local credentials and AI setup reference
├── database/
│   ├── migrations/              # PostgreSQL DDL migrations (0001_init.sql)
│   ├── seeds/                   # JSON seed corpus and load-seed.sql
│   ├── load-seed.sh             # Runnable seed data loading script
│   ├── queries.sql              # Required SQL queries (Keyset, FTS, RAG, Audit)
│   └── ER_MODEL.md              # 8-table schema documentation & Mermaid ER diagram
├── backend/
│   ├── pom.xml                  # Spring Boot dependencies
│   ├── Dockerfile               # Backend container definition
│   └── src/main/java/com/riwi/  # Controllers, Security, RAG providers, JDBC helpers
├── frontend/
│   ├── package.json             # React dependencies
│   ├── Dockerfile               # Frontend Nginx container definition
│   └── src/                     # React UI components (3 Zones, STOMP, Themes)
└── tests/
    ├── e2e_api_test.sh          # 12-step REST E2E test script
    └── integration/
        ├── rls_security_test.sql # Automated PostgreSQL test suite (8 test cases)
        └── test_runner.sh       # Executable test runner script
```

---

## 🛡️ License
Copyright © 2026 Riwi Co. S.A.S. All rights reserved.
