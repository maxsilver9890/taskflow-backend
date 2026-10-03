# TaskFlow

TaskFlow is a multi-tenant task and project management application. The workspace contains an Express/TypeScript backend and a Next.js frontend.

## Project Status

| Area | Status | Notes |
| --- | --- | --- |
| Data modeling and database design | Complete | PostgreSQL, Prisma migrations, relationships, indexes, and seed data |
| Authentication and authorization | Complete | JWT access tokens, refresh-token rotation, roles, rate limiting, and tenant scoping |
| Projects and tasks API | Complete | CRUD, filters, pagination, assignments, dashboards, and validation |
| Background jobs and notifications | Complete | BullMQ, Redis, worker process, retries, email provider, and DLQ |
| Testing and API documentation | Complete | Unit/integration tests, OpenAPI, Swagger UI, and Postman collection |

## Technology Stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js, TypeScript, Express 5 |
| Frontend | Next.js, React, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Jobs | Redis, BullMQ |
| Validation and security | Zod, JWT, bcrypt, Helmet, CORS, rate limiting |
| Testing and tooling | Vitest, Supertest, ESLint, Docker Compose |

## Architecture

```text
Browser
   |
   v
Next.js frontend
   |
   v
Express API
   |
   +--> Authentication and authorization
   +--> Projects and tasks
   +--> Job status
   +--> Prisma ------------------> PostgreSQL
   |
   +--> BullMQ ------------------> Redis
                                      |
                                      v
                                Background worker
                                      |
                                      v
                                Email provider
```

### Repository Layout

```text
taskflow/
|-- taskflow-backend/
|   |-- prisma/                 Database schema, migrations, and seed
|   |-- src/
|   |   |-- auth/               Authentication routes and services
|   |   |-- docs/               OpenAPI document and Swagger UI
|   |   |-- jobs/               Queues, processors, and job status API
|   |   |-- projects/           Project routes and services
|   |   |-- tasks/              Task routes, services, and assignments
|   |   |-- worker/             Background worker entry point
|   |-- tests/                  Unit and integration tests
|   |-- docker-compose.yml      API, worker, PostgreSQL, and Redis
|-- taskflow-frontend/
|   |-- src/app/                Next.js routes and layouts
|   |-- src/components/         Shared UI and feature components
|   |-- src/hooks/              Data-fetching hooks
|   |-- src/lib/                API clients and frontend utilities
```

## Prerequisites

- Node.js 22 or newer
- Docker Desktop with Docker Compose
- npm

## Local Setup

Run backend commands from `taskflow-backend/`.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `taskflow-backend/.env` with values for the local services. At minimum:

```env
POSTGRES_DB=taskflow
POSTGRES_USER=taskflow
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql://taskflow:change_me@localhost:5433/taskflow

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=replace_with_a_local_secret
JWT_REFRESH_SECRET=replace_with_a_different_local_secret
EMAIL_PROVIDER=console
```

Do not commit real secrets. The development password shown below is for local seeded data only.

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
```

### 4. Apply migrations, generate Prisma Client, and seed data

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

For active schema development, use `npm run prisma:migrate` instead of `prisma migrate deploy`.

### 5. Start the API

```bash
npm run dev
```

The API is available at `http://localhost:3000`.

### 6. Start the frontend

Run these commands from `taskflow-frontend/`:

```bash
npm install
npm run dev
```

The frontend is available at `http://localhost:3001` unless Next.js selects another port.

## Docker Compose

The complete backend stack is available with:

```bash
docker compose up --build
```

| Service | Purpose | Local address |
| --- | --- | --- |
| `api` | Express HTTP API | `http://localhost:3000` |
| `worker` | BullMQ email processor | No public port |
| `postgres` | Application database | `localhost:5433` |
| `redis` | Queue backend | `localhost:6379` |

The API and worker wait for PostgreSQL and Redis health checks before starting. Containers use `postgres:5432` and `redis:6379`; host-side commands use `localhost:5433` and `localhost:6379`.

## Database

Prisma manages the PostgreSQL schema. The main tables are:

| Domain | Tables |
| --- | --- |
| Identity and tenancy | `users`, `organizations`, `org_members`, `refresh_tokens` |
| Work management | `projects`, `tasks`, `task_assignments`, `comments` |

The schema also defines PostgreSQL enums for task status, task priority, and organization membership roles.

Seed data includes 2 organizations, 5 users, 5 memberships, 4 projects, 12 tasks, assignments, and comments.

```bash
npx prisma migrate status
npx prisma studio
```

Prisma Studio runs at `http://localhost:5555`.

### Development Credentials

Seeded users use:

```text
Password: TaskFlowDemo123!
```

Passwords are stored as bcrypt hashes with a cost factor of 12 or higher.

## API Overview

All protected endpoints require:

```http
Authorization: Bearer <access_token>
```

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a user, organization, membership, and tokens |
| `POST` | `/auth/login` | Authenticate with email and password |
| `POST` | `/auth/refresh` | Rotate a refresh token and issue a new access token |
| `POST` | `/auth/logout` | Revoke a refresh token |

Access tokens expire after 15 minutes by default. Refresh tokens are persisted as SHA-256 hashes, expire after 7 days by default, and cannot be replayed after rotation or revocation. Authentication endpoints are limited to 10 requests per minute per IP.

### Projects and Tasks

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/projects` | Create a project |
| `GET` | `/projects` | List organization projects |
| `GET` | `/projects/:id` | Get a project |
| `PATCH` | `/projects/:id` | Update a project |
| `DELETE` | `/projects/:id` | Delete a project |
| `GET` | `/projects/:id/dashboard` | Get task counts by status |
| `POST` | `/tasks` | Create a task |
| `GET` | `/tasks` | List organization tasks |
| `GET` | `/tasks/:id` | Get a task |
| `PATCH` | `/tasks/:id` | Update a task |
| `DELETE` | `/tasks/:id` | Delete a task |
| `POST` | `/tasks/:id/assign` | Assign a task to an organization member |
| `DELETE` | `/tasks/:id/assign/:userId` | Remove a task assignment |

Task listing supports `status`, `priority`, `assignee`, `dueFrom`, `dueTo`, and `projectId` filters, plus offset pagination:

```text
GET /tasks?page=1&limit=20
```

Paginated responses have this shape:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

Validation uses Zod. Errors use a consistent shape:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {}
}
```

### Job Status and API Documentation

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/jobs/:id` | Get an organization-scoped job status |
| `GET` | `/health` | Check API and Redis health |
| `GET` | `/api-docs` | Open Swagger UI |
| `GET` | `/api-docs/openapi.json` | Download the OpenAPI document |

Swagger UI is available at `http://localhost:3000/api-docs`.

## Background Jobs

Task assignment persists the database record before attempting to enqueue an email job:

```text
POST /tasks/:id/assign
        |
        v
Insert task_assignments in PostgreSQL
        |
        v
Add task_assigned job to Redis/BullMQ
        |
        v
Return 201 with assignment and optional jobId
        |
        v
Worker -> email.processor.ts -> email provider
```

### Queue Topology

| Queue | Purpose |
| --- | --- |
| `taskflow-email` | Main assignment-notification queue |
| `taskflow-email-dlq` | Explicit dead-letter queue for exhausted jobs |

Jobs have 3 attempts with exponential backoff: 1 second, 2 seconds, then 4 seconds. Failed jobs remain queryable in the main queue. After the final failure, the worker copies the original job ID, payload, attempt count, and failure reason to the DLQ. DLQ entries are not retried automatically.

Every job payload includes `organizationId`, which is derived from the authenticated request. Job status requests compare that value with the caller's organization before returning metadata; cross-tenant probes return `403 Forbidden`.

If database persistence succeeds but queue enqueueing fails, the assignment remains and the API returns `201` without a `jobId`. The enqueue failure is logged at warning level. This persist-first strategy avoids phantom assignments while accepting that a notification may be missed during a temporary Redis outage.

## Testing

Tests use a separate database and must never target the development database.

### One-time test database setup

```bash
docker compose up -d postgres redis
docker compose exec postgres psql -U taskflow -d taskflow -c "CREATE DATABASE taskflow_test;"
```

Create `.env.test` from `.env.test.example`, then run:

```bash
npm run test:migrate
npm test
```

All test scripts load `.env.test` automatically through `dotenv-cli`:

```bash
npm run test:unit
npm run test:integration
npm run test:watch
npm run test:coverage
```

Integration tests exercise the HTTP app against the isolated database and reset data between tests. CI runs the same suite against fresh PostgreSQL and Redis service containers.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile the backend |
| `npm run typecheck` | Run TypeScript checks without emitting files |
| `npm run lint` | Run ESLint |
| `npm run dev` | Start the API with file watching |
| `npm run worker:dev` | Start the worker with file watching |
| `npm run worker` | Start the compiled worker |
| `npx prisma studio` | Open the database browser |

## Security and Tenant Assumptions

- Registration creates a new organization and assigns the registering user the `ORG_ADMIN` role.
- Supported roles are `ORG_ADMIN` and `MEMBER`.
- Authenticated context contains `userId`, `orgId`, and `role`.
- Project, task, assignment, and job queries are scoped by the authenticated organization.
- Client-supplied organization IDs are not used as the authorization source.
- Refresh tokens are hashed and rotated; revoked tokens cannot be reused.
- Logout revokes the refresh token. Existing access tokens remain valid until their short TTL expires.
- A user can currently authenticate against a selected membership. Explicit organization switching is outside the current API scope.

## API Collections

The Postman collection is available at:

```text
taskflow-backend/postman/TaskFlow.postman_collection.json
```
