# TaskFlow Backend

Multi-tenant task and project management API built with **Node.js**, **TypeScript**, **Express**, **PostgreSQL**, **Prisma**, **Redis/Valkey**, and **BullMQ**.

## Project Status

| Assignment Task                                  |   Status   |
| ------------------------------------------------ | :---------: |
| Task 01 — Data Modeling & Database Design       | ✅ Complete |
| Task 02 — Authentication & Authorization        | ✅ Complete |
| Task 03 — REST API: Projects & Tasks            | ✅ Complete |
| Task 04 — Background Jobs & Email Notifications | ✅ Complete |
| Task 05 — Testing & API Documentation           | ✅ Complete |

---

## Tech Stack

- **Node.js 22+**
- **TypeScript**
- **Express 5**
- **PostgreSQL 17**
- **Prisma ORM**
- **Redis / Valkey**
- **BullMQ**
- **Zod**
- **JWT**
- **bcrypt**
- **Vitest**
- **Supertest**
- **Swagger UI / OpenAPI**
- **Docker / Docker Compose**

---

## Architecture

```text
                          ┌──────────────────┐
                          │      Client      │
                          │  Postman / HTTP  │
                          └────────┬─────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │    Express API      │
                        │                     │
                        │ Auth / Projects     │
                        │ Tasks / Jobs        │
                        │ Validation / RBAC   │
                        └──────┬────────┬─────┘
                               │        │
                               │        ▼
                               │   ┌──────────────┐
                               │   │ Redis/BullMQ │
                               │   └──────┬───────┘
                               │          │
                               │          ▼
                               │   ┌──────────────┐
                               │   │    Worker    │
                               │   │ Email jobs   │
                               │   └──────────────┘
                               │
                               ▼
                       ┌─────────────────────┐
                       │     PostgreSQL      │
                       │       Prisma        │
                       └─────────────────────┘
```

The API and Worker are separate processes. Task assignment persists the assignment first and then enqueues the notification job.

---

# Task 01 — Data Modeling & Database Design

## Implemented

- Users
- Organizations
- Organization memberships
- Projects
- Tasks
- Task assignments
- Comments
- Refresh tokens
- PostgreSQL enums
- Foreign-key relationships
- Indexes
- Prisma migrations
- Deterministic seed data

## Seed Dataset

```text
5 users
2 organizations
5 organization memberships
4 projects
12 tasks
12 task assignments
6 comments
```

Seeded development users use:

```text
Password: TaskFlowDemo123!
```

Passwords are hashed with bcrypt using cost factor `12`.

---

# Task 02 — Authentication & Authorization

## Endpoints

```http
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

## Authentication

- JWT access tokens
- 15-minute access-token TTL
- Organization ID and role included in access-token claims
- Organization context derived from authenticated state
- `ORG_ADMIN` and `MEMBER` roles
- IP-based authentication rate limiting

## Password Security

- bcrypt password hashing
- bcrypt cost factor >= 12
- Plaintext passwords are never stored

## Refresh Tokens

- 7-day TTL
- Persisted in PostgreSQL
- Stored as SHA-256 hashes
- Rotation on refresh
- Revocation support
- Replay/reuse rejection
- Logout revokes the supplied refresh token

## Registration

Registration creates:

1. A user
2. A new organization
3. An `ORG_ADMIN` membership
4. An access token
5. A refresh token

The client does not supply the organization ID or initial role.

---

# Task 03 — REST API: Projects & Tasks

## Project Endpoints

| Method     | Endpoint                    | Purpose           |
| ---------- | --------------------------- | ----------------- |
| `POST`   | `/projects`               | Create project    |
| `GET`    | `/projects`               | List projects     |
| `GET`    | `/projects/:id`           | Get project       |
| `PATCH`  | `/projects/:id`           | Update project    |
| `DELETE` | `/projects/:id`           | Delete project    |
| `GET`    | `/projects/:id/dashboard` | Project dashboard |

## Task Endpoints

| Method     | Endpoint       | Purpose           |
| ---------- | -------------- | ----------------- |
| `POST`   | `/tasks`     | Create task       |
| `GET`    | `/tasks`     | List/filter tasks |
| `GET`    | `/tasks/:id` | Get task          |
| `PATCH`  | `/tasks/:id` | Update task       |
| `DELETE` | `/tasks/:id` | Delete task       |

## Assignment Endpoints

| Method     | Endpoint                      | Purpose       |
| ---------- | ----------------------------- | ------------- |
| `POST`   | `/tasks/:id/assign`         | Assign user   |
| `DELETE` | `/tasks/:id/assign/:userId` | Unassign user |

## Task Filters

```text
status
priority
assignee
dueFrom
dueTo
projectId
```

## Pagination

```http
GET /tasks?page=1&limit=20
```

Example response:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

## Multi-Tenant Authorization

- Organization scope is derived from the authenticated JWT.
- Client-supplied organization IDs are not trusted for authorization.
- Cross-tenant project access returns `403 Forbidden`.
- Cross-tenant task access returns `403 Forbidden`.
- Cross-tenant resource data is not exposed.

## Project Dashboard

Task counts are grouped by:

```text
TODO
IN_PROGRESS
REVIEW
DONE
```

---

# Task 04 — Background Jobs & Email Notifications

## Assignment Notification Flow

```text
POST /tasks/:id/assign
        │
        ├── Persist assignment in PostgreSQL
        │
        └── Enqueue task_assigned job
                    │
                    ▼
                Redis/BullMQ
                    │
                    ▼
                  Worker
                    │
                    ▼
             Email Provider
```

## Queue & Worker

- Redis-backed BullMQ queue
- Dedicated Worker process
- Asynchronous email processing
- Console email provider for local development

Default local provider:

```env
EMAIL_PROVIDER=console
```

The console provider logs the notification instead of sending real email.

## Retry Policy

```text
3 total attempts
1st retry → 1 second
2nd retry → 2 seconds
3rd retry → 4 seconds
```

## Dead-Letter Queue

Exhausted email jobs are forwarded to:

```text
taskflow-email-dlq
```

The original failed job remains queryable.

## Job Status

```http
GET /jobs/:id
```

Supported statuses:

```text
pending
active
completed
failed
```

Job status is organization-scoped. Cross-tenant job access returns `403 Forbidden`.

---

# Task 05 — Testing & API Documentation

## Unit Tests

Coverage includes:

- Authentication logic
- Assignment validation
- Pagination

## Integration Tests

Coverage includes:

- Registration
- Login
- Refresh validation
- Duplicate email handling
- Task CRUD
- Task validation
- Cross-tenant access → `403`
- Authentication/error scenarios

## Isolated Test Database

Integration tests use a dedicated PostgreSQL database:

```text
taskflow_test
```

The test database is isolated from the normal development database.

## Test Commands

### Full test suite

```bash
npm test
```

### Unit tests

```bash
npm run test:unit
```

### Integration tests

```powershell
$env:DATABASE_URL="postgresql://taskflow:change_me@localhost:5433/taskflow_test"
npm run test:integration
Remove-Item Env:DATABASE_URL
```

## Typecheck

```bash
npx tsc --noEmit
```

## Production Build

```bash
npm run build
```

---

# API Documentation

## Public Swagger UI

https://taskflow-backend-api-7iwy.onrender.com/api-docs

## Public OpenAPI JSON

https://taskflow-backend-api-7iwy.onrender.com/api-docs/openapi.json

The OpenAPI documentation covers:

- Authentication
- Projects
- Tasks
- Assignments
- Background jobs
- Request schemas
- Response schemas
- Common error responses

For local development:

```text
http://localhost:3000/api-docs
http://localhost:3000/api-docs/openapi.json
```

---

# Postman Collection

The repository includes:

```text
postman/TaskFlow.postman_collection.json
```

The collection covers:

### Health

- Health check

### Auth

- Register
- Login
- Refresh
- Logout

### Projects

- Create
- List
- Get
- Update
- Dashboard
- Delete

### Tasks

- Create
- List
- Get
- Update
- Filter
- Assign
- Unassign
- Delete

### Jobs

- Get job status

Collection variables:

```text
baseUrl
accessToken
refreshToken
projectId
taskId
userId
jobId
```

---

# Local Development

## Prerequisites

- Node.js 22+
- Docker Desktop

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

Copy:

```text
.env.example
```

to:

```text
.env
```

Populate local secrets and configuration.

> Never commit `.env` or other local secret files.

## 3. Generate Prisma Client

```bash
npx prisma generate
```

## 4. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
```

## 5. Check database migrations

```bash
npx prisma migrate status
```

## 6. Seed development data

```bash
npx prisma db seed
```

> The seed resets and recreates seeded application data. Do not run it when you need to preserve manually-created development records.

## 7. Start the API

```bash
npm run dev
```

API:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

## 8. Start the Worker

In a second terminal:

```bash
npm run worker:dev
```

## 9. Prisma Studio

Optional:

```bash
npx prisma studio
```

Studio:

```text
http://localhost:5555
```

---

# Environment & Secrets

## Local `.env`

`.env` contains local development secrets and is intentionally ignored by Git.

Important values include:

```env
JWT_SECRET=<64-byte-random-hex>
JWT_REFRESH_SECRET=<64-byte-random-hex>
POSTGRES_PASSWORD=change_me
```

## `.env.example`

The repository contains a safe template:

```text
.env.example
```

It contains placeholders only.

## Host vs Docker Database URL

When running Prisma or the API directly from Windows:

```text
postgresql://taskflow:change_me@localhost:5433/taskflow
```

When the API/Worker run inside Docker:

```text
postgresql://taskflow:change_me@postgres:5432/taskflow
```

Inside Docker, `postgres` is the Compose service name.

---

# Docker Compose

## Services

```text
api
worker
postgres
redis
```

## Validate Compose configuration

```bash
docker compose config
```

## Start the complete stack

```bash
docker compose up -d --build
```

## Stop the stack

```bash
docker compose down
```

## Local Ports

| Service    |     Port |
| ---------- | -------: |
| API        | `3000` |
| PostgreSQL | `5433` |
| Redis      | `6379` |

The API and Worker wait for healthy PostgreSQL and Redis services before starting.

---

# Deployment

## Public API

The API is deployed as a Render Web Service:

**https://taskflow-backend-api-7iwy.onrender.com**

Health check:

**https://taskflow-backend-api-7iwy.onrender.com/health**

## Public API Documentation

Swagger UI:

**https://taskflow-backend-api-7iwy.onrender.com/api-docs**

OpenAPI JSON:

**https://taskflow-backend-api-7iwy.onrender.com/api-docs/openapi.json**

## Render Infrastructure

The current public deployment uses:

```text
Render Web Service
Render PostgreSQL
Render Key Value (Valkey / Redis-compatible)
```

The API, PostgreSQL, and Key Value services are deployed in the same Render region and communicate through the Render private network.

## Worker Deployment

The BullMQ Worker is implemented as a separate process and is included in the repository and Docker Compose configuration.

The Worker is **not deployed as a Render Background Worker** for this assignment because that service requires a paid instance.

The complete Worker architecture is reproducible locally with Docker Compose:

```text
API
  |
  v
Redis / BullMQ
  |
  v
Worker
  |
  v
Email Provider
```

Run the complete local stack with:

```bash
docker compose up -d --build
```

Or run the Worker directly during development:

```bash
npm run worker:dev
```

Task 04 queue processing, retries, dead-letter queue behavior, job status, and cross-tenant job protection were verified locally with the API and Worker running against PostgreSQL and Redis.

## Deployment Scope

The public Render deployment is intended for API access and demonstration.

The repository remains the source of truth for the complete application architecture, including:

- API
- Worker
- PostgreSQL
- Redis / BullMQ
- Authentication
- Projects and Tasks
- Background jobs
- Testing
- Swagger/OpenAPI
- Postman collection

---

# Repository Structure

```text
taskflow-backend/
├── src/
│   ├── auth/
│   ├── config/
│   ├── docs/
│   ├── jobs/
│   ├── middleware/
│   ├── projects/
│   ├── routes/
│   └── tasks/
├── worker/
├── prisma/
├── tests/
│   ├── unit/
│   └── integration/
├── postman/
│   └── TaskFlow.postman_collection.json
├── Dockerfile
├── docker-compose.yml
├── prisma.config.ts
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .gitignore
└── README.md
```

---

# Development Credentials

Seeded development users use:

```text
Password: TaskFlowDemo123!
```

Examples:

```text
ava.shah@northstar.example
liam.chen@northstar.example
maya.rao@northstar.example
noah.kim@blueorbit.example
sara.ali@blueorbit.example
```

These credentials are for local development/testing only.

---

# Final Verification

Run:

```bash
npx prisma generate
npx tsc --noEmit
npm test
npm run build
docker compose config
```

The repository should not contain:

```text
.env
.env.test
node_modules/
dist/
coverage/
```

Only the safe environment template should be committed:

```text
.env.example
```

---

# Git

Primary branch:

```text
main
```

Repository:

https://github.com/maxsilver9890/taskflow-backend

The repository contains the completed TaskFlow backend implementation, automated tests, OpenAPI documentation, Postman collection, Docker configuration, and reproducible Worker architecture.
