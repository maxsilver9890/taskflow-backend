# TaskFlow Backend

Multi-tenant task/project management backend built with Node.js, TypeScript, Express, PostgreSQL, Prisma, Redis, and BullMQ.

## Project Status

Implementation is currently complete through:

* ✅ Task 01 — Data Modeling & Database Design
* ✅ Task 02 — Authentication & Authorization
* ✅ Task 03 — REST API: Projects & Tasks
* ⏳ Task 04 — Background Jobs & Email Notifications
* ⏳ Task 05 — Testing & API Documentation

The remaining Task 04 and Task 05 requirements will be implemented before final submission.

---

## Tech Stack

* Node.js
* TypeScript
* Express
* PostgreSQL
* Prisma ORM
* Redis
* BullMQ
* Zod
* JWT
* bcrypt
* Docker / Docker Compose

---

# Current Architecture

```
Client
  |
  v
Express API
  |
  +-- Authentication / Authorization
  |
  +-- Projects API
  |
  +-- Tasks API
  |
  +-- Prisma
        |
        v
    PostgreSQL

Redis / BullMQ / Worker
    → Task 04
```

Current application structure:

```
src/
├── auth/
├── config/
├── lib/
├── middleware/
├── projects/
├── tasks/
└── server.ts
```

---

# Database

PostgreSQL is managed through Prisma.

Current schema includes:

* `<span>users</span>`
* `<span>organizations</span>`
* `<span>org_members</span>`
* `<span>projects</span>`
* `<span>tasks</span>`
* `<span>task_assignments</span>`
* `<span>comments</span>`
* `<span>refresh_tokens</span>`

The database uses PostgreSQL enums for task status, task priority, and organization membership roles.

## Migrations

Prisma migrations are stored in:

```
prisma/migrations/
```

Current database status can be checked with:

```
npx prisma migrate status
```

Expected:

```
Database schema is up to date!
```

## Seed Data

The seed creates:

* 2 organizations
* 5 users
* 5 organization memberships
* 4 projects
* 12 tasks
* task assignments
* comments

Seed data can be recreated with:

```
npx prisma db seed
```

### Development Credentials

Seeded development users use:

```
Password: TaskFlowDemo123!
```

These credentials are for local development/testing only.

Seeded passwords are hashed with bcrypt using cost factor 12.

---

# Local Development

## Install dependencies

```
npm install
```

## Generate Prisma Client

Required after a fresh install or schema/client change:

```
npx prisma generate
```

## Database

The Docker PostgreSQL service is exposed on:

```
localhost:5433
```

Connection used by host-side Prisma commands:

```
postgresql://taskflow:change_me@localhost:5433/taskflow
```

Inside Docker, services should connect to PostgreSQL using:

```
postgres:5432
```

## Redis

Redis is exposed locally on:

```
localhost:6379
```

When the API runs directly from Windows:

```
REDIS_HOST=localhost
REDIS_PORT=6379
```

When the API runs inside Docker:

```
REDIS_HOST=redis
REDIS_PORT=6379
```

---

# Running the Application

Start PostgreSQL and Redis:

```
docker compose up -d postgres redis
```

Start the API:

```
npm run dev
```

Health check:

```
GET http://localhost:3000/health
```

Expected:

```
{
  "status": "ok"
}
```

---

# Task 01 — Data Modeling & Database Design

## Completed

Implemented:

* PostgreSQL relational schema
* Users and organizations
* Organization memberships
* Projects
* Tasks
* Task assignments
* Comments
* PostgreSQL enums
* Foreign-key relationships
* Indexes
* Prisma migrations
* Deterministic seed data

Database verification was performed using:

```
npx prisma migrate status
```

and Prisma Studio.

Prisma Studio:

```
npx prisma studio
```

Then open:

```
http://localhost:5555
```

---

# Task 02 — Authentication & Authorization

## Completed

Implemented:

```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

### Password Security

* bcrypt password hashing
* bcrypt cost factor >= 12
* plaintext passwords are never stored

### Access Tokens

* JWT access tokens
* 15-minute TTL
* organization context included in authenticated context
* role included in authentication context

### Refresh Tokens

* 7-day TTL
* persisted in PostgreSQL
* refresh tokens stored as SHA-256 hashes
* refresh-token revocation
* refresh-token rotation
* replay of revoked refresh token is rejected

### Registration

Registration creates:

1. a user
2. a new organization
3. an `<span>ORG_ADMIN</span>` organization membership
4. an access token
5. a refresh token

The client does not supply the organization ID or initial role.

### Roles

Supported roles:

```
ORG_ADMIN
MEMBER
```

### Authentication Middleware

Authenticated requests receive:

```
userId
orgId
role
```

Organization context is derived from authenticated state and is not taken from arbitrary client-provided `<span>org_id</span>`.

### Rate Limiting

Authentication endpoints are rate limited to:

```
10 requests / minute / IP
```

### Manual Verification Completed

Verified through Postman:

* registration → 201
* login → 200
* invalid credentials → 401
* access-token TTL → 15 minutes
* refresh → 200
* refresh-token rotation
* old refresh-token rejection
* logout
* revoked refresh-token rejection
* authentication rate limiting

---

# Task 03 — REST API: Projects & Tasks

## Completed

### Project endpoints

```
POST   /projects
GET    /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
GET    /projects/:id/dashboard
```

### Task endpoints

```
POST   /tasks
GET    /tasks
GET    /tasks/:id
PATCH  /tasks/:id
DELETE /tasks/:id
```

### Assignment endpoints

```
POST   /tasks/:id/assign
DELETE /tasks/:id/assign/:userId
```

### Task Filters

Implemented:

```
status
priority
assignee
dueFrom
dueTo
projectId
```

### Pagination

Offset pagination is supported using:

```
?page=1&limit=20
```

Responses include:

```
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

### Validation

Request validation is performed using Zod.

### Error Handling

Consistent application errors are returned using:

```
{
  "error": "...",
  "code": "...",
  "details": {}
}
```

### Organization Scoping

Project and task queries are organization-scoped using the authenticated user's organization context.

Client-provided organization IDs are not used as the authorization source.

### Cross-Tenant Protection

Verified:

```
Organization A user
    ↓
Organization B project/task
    ↓
403 Forbidden
```

No cross-tenant resource data is returned.

### Dashboard

Project dashboard provides task counts grouped by:

```
todo
in_progress
review
done
```

### Manual Verification Completed

Verified through Postman:

* project creation
* project retrieval
* project listing
* project update
* project dashboard
* task creation
* task retrieval
* task update
* status filtering
* priority filtering
* assignee filtering
* due-date range filtering
* pagination
* task assignment
* task unassignment
* same-organization assignment validation
* cross-tenant project access → 403
* cross-tenant task access → 403

---

# Task 04 — Background Jobs & Email Notifications

## Pending

Required work:

* BullMQ queues
* Redis-backed job processing
* assignment notification job
* worker process
* asynchronous email notification
* assignment/job consistency strategy
* 3 retries
* exponential backoff:
  * 1 second
  * 2 seconds
  * 4 seconds
* dead-letter queue
* `<span>GET /jobs/:id</span>`
* job status reporting
* Docker Compose API + Worker + PostgreSQL + Redis integration

---

# Task 05 — Testing & API Documentation

## Pending

### Unit tests

Required coverage includes:

* authentication
* assignment validation
* pagination

### Integration tests

Required coverage includes:

* login flow
* task CRUD
* cross-tenant access → 403
* validation/error scenarios
* isolated test database/reset strategy

### API Documentation

Pending:

* OpenAPI / Swagger
* Swagger UI
* Postman or Bruno collection

---

# Docker Status

Docker infrastructure currently supports:

```
PostgreSQL
Redis
```

Current local mappings:

```
PostgreSQL → localhost:5433
Redis      → localhost:6379
```

The final assignment requires the complete Compose stack:

```
api
worker
postgres
redis
```

The API/Worker production-style container workflow will be finalized during Task 04.

---

# Known Development Assumptions

## Organization Registration

Self-registration creates a new organization and makes the registering user:

```
ORG_ADMIN
```

## Multi-Organization Users

The current authentication design selects an organization membership when issuing authentication context. A future organization-selection endpoint could support explicit switching if multi-organization user flows are expanded.

## Refresh Token Security

Refresh tokens are stored hashed and rotated on successful refresh.

A revoked refresh token cannot be reused.

## Access Token Logout

Logout revokes the refresh token. Existing access tokens remain valid until their short TTL expires.

---

# Current Progress

```
Task 01  ████████████████████ 100%
Task 02  ████████████████████ 100%
Task 03  ████████████████████ 100%
Task 04  ████████████████████ 100%
Task 05  ░░░░░░░░░░░░░░░░░░░░   0%
```

---

# Task 04 — Background Jobs & Email Notifications

## Architecture

```
POST /tasks/:id/assign
       │
       ▼
task-assignment.service.ts
  1. INSERT task_assignments (Postgres)      ← DB commit
  2. emailQueue.add("task_assigned", …)      ← Redis / BullMQ enqueue
     payload includes organizationId for tenant isolation
  3. Return 201 { …assignment, jobId }
       │
       ▼  (async, separate process)
worker/worker.ts  →  email.processor.ts
  - Processes jobs from taskflow:email
  - Calls emailProvider.send(…)
  - On failure: retry with exponential back-off (1 s → 2 s → 4 s)
  - After attempt 3 fails:
      a. Original job stays in taskflow:email "failed" set (queryable)
      b. Worker forwards a DLQ entry to taskflow:email:dlq
```

## Queue Topology

| Queue                | Purpose                                                    |
|----------------------|------------------------------------------------------------|
| `taskflow:email`     | Main queue. Jobs enqueued on task assignment.              |
| `taskflow:email:dlq` | Explicit DLQ. Receives entries after all 3 retries fail.   |

### DLQ Flow

1. `POST /tasks/:id/assign` → job added to `taskflow:email` (main queue).
2. Worker picks up the job and calls `emailProvider.send()`.
3. On failure, BullMQ retries with back-off: **1 s → 2 s → 4 s** (3 total attempts).
4. After attempt 3 fails:
   - BullMQ marks the job **failed** in the main queue (`removeOnFail: false`).  
     The original job ID remains resolvable via `GET /jobs/:id` with `status: "failed"`.
   - The worker's `failed` event handler detects exhaustion (`attemptsMade >= attempts`)  
     and adds a `DlqEntry` to `taskflow:email:dlq` containing the original job ID,  
     failure reason, attempt count, and full payload.
   - DLQ entries never expire and are never retried automatically.
   - If the DLQ enqueue itself fails, the error is logged at ERROR level; the  
     worker process does not crash.

### Why two representations?

- **Main queue "failed" set** — preserves the original job ID returned to the  
  API caller so `GET /jobs/:id` always resolves.
- **Explicit DLQ queue** — gives operators a clean, dedicated queue for  
  inspection, bulk replay, or alerting, independent of BullMQ internals.

## Environment Variables (Task 04)

| Variable         | Default     | Description                              |
|------------------|-------------|------------------------------------------|
| `EMAIL_PROVIDER` | `console`   | Email driver. `console` logs to stdout.  |

Add to `.env` (already in `.env.example`):

```
EMAIL_PROVIDER=console
```

## Job Status Endpoint

```
GET /jobs/:id
Authorization: Bearer <access_token>
```

Response:
```json
{
  "jobId": "1",
  "status": "completed",
  "type": "task_assigned",
  "createdAt": "2026-08-22T10:00:00.000Z",
  "finishedAt": "2026-08-22T10:00:00.123Z",
  "attemptsMade": 1,
  "failedReason": null
}
```

Status values: `pending` | `active` | `completed` | `failed`

Failed jobs (exhausted retries) remain in the main queue's failed set and are never deleted, so they stay queryable.

### Tenant Isolation

Every job payload embeds `organizationId` at enqueue time (from the JWT, never from the client).  
`GET /jobs/:id` compares the payload's `organizationId` against `req.auth.orgId`:

- Match → returns job status.
- Mismatch → **403 Forbidden** with no job metadata exposed.
- Not found → **404 Job Not Found**.

A user from org A cannot probe job IDs to discover org B's task assignment activity.

## Consistency Strategy

Assignment DB write and BullMQ enqueue are **not** in a distributed transaction.

Strategy: **persist first, enqueue second**.

- If the DB write fails → no assignment, no job. Clean state.
- If the enqueue fails → assignment exists, email not sent. The error is logged at WARN level. The assignment is not rolled back. The API still returns 201 because the resource was successfully created.

The `jobId` returned in the 201 response will be absent if the enqueue failed.

Trade-off accepted: a missed notification is preferable to a phantom assignment or a 500 response when Redis is briefly unavailable. A transactional outbox pattern would eliminate this gap at the cost of significant additional complexity.

## Docker Compose

All four required services are wired up:

```bash
docker compose up --build
```

Services: `api` · `worker` · `postgres` · `redis`

The `worker` service starts `node dist/worker/worker.js` and connects to the same Redis instance as the API. Both wait for `postgres` and `redis` to pass their health checks before starting.

---

# Remaining Work Before Submission

1. Implement Task 05 tests and API documentation.
2. Final README cleanup and setup verification.
3. Verify repository contains no committed secrets.
4. Prepare final API collection/demo and submission materials.
