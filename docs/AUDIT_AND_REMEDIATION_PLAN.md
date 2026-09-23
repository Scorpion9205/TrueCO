# TrueCO: Codebase Audit & Phased Remediation Plan

**Audit date:** 2026-09-23 · **Baseline commit:** `ffd331c` (main)

At the baseline, `tsc --noEmit` is clean and all 162 unit tests pass. The module layout, dependency injection and adapter boundaries are consistent. The problems are in runtime behaviour: several guarantees described in `IMPLEMENTATION_PLAN.md` and the ADD are not enforced by the code.

This document lists every finding, ranks it, and assigns it to a remediation phase. Each phase has exit criteria that must pass before the next phase starts, following the phase-gate rule in `.agents/AGENTS.md`.

Status legend: ✅ fixed · 🚧 in progress · ⬜ not started

---

## 1. Findings

### 🔴 Critical

| ID | Finding | Location | Phase | Status |
|----|---------|----------|-------|--------|
| C1 | About 75 async controller handlers never forward rejected promises. On Express 4 with Node 22 and no `unhandledRejection` handler, one failed login (`AppError` thrown) crashes the process. | `modules/*/**.controller.ts`, `main.ts` | 0 | ✅ |
| C2 | `POST /api/v1/whatsapp-assistant/inbound` has no authentication and takes the sender phone from the request body. Anyone can read any parent's fee and attendance data and spend the coaching's AI credits. | `whatsapp-assistant.routes.ts` | 0 | ✅ |
| C3 | The RS256 JWT private key is committed (`apps/api/.keys/`, first added in `95c30cd`). Anyone with repo access can forge tokens. | `apps/api/.keys/` | 0 | ✅ (history purge pending) |
| C4 | OTP codes and password-reset tokens are logged in plaintext in every environment. Email delivery is not implemented, so logs are the only place they go. `send-otp` / `verify-otp` are public. OTPs have no attempt limit. | `otp.service.ts`, `auth.service.ts` | 0 | ✅ |
| C5 | Tenant isolation fails open. With no `coachingId` in context (workers, cron jobs, webhooks, public routes), the Prisma extension applies no tenant filter. The RLS SQL is never applied and `withTenantRlsContext` is unused (and interpolates SQL). `findUnique` rewriting drops `select`/`include`. `aggregate`, `groupBy`, `*OrThrow` and the update branch of `upsert` are unscoped. Knowledge-base, `AiUsageLog` and `Role` models are not tenant-registered. The "cross-tenant isolation" test runs against a mocked client, not a database. | `tenant-prisma.extension.ts`, `rls-init.sql` | 1 | ✅ |
| C6 | Webhooks: the WhatsApp HMAC check passes everything when `WHATSAPP_APP_SECRET` is unset. The Razorpay fee and billing webhooks are not idempotent, so provider retries double-record payments, upgrades and credit purchases. | `notification.controller.ts`, `fee.service.ts`, `billing.service.ts` | 0 (fail-closed) / 3 (idempotency) | 🚧 |

### 🟠 High

| ID | Finding | Phase | Status |
|----|---------|-------|--------|
| H1 | Fee payments: installment balance is read outside a row lock, and money is summed as JS `Number`. Receipt numbers are `date + random(4)` and globally unique, so they collide and are not sequential per coaching. | 3 | ⬜ |
| H2 | The login lockout key trusts the client-supplied `X-Forwarded-For`. `trust proxy` is not set. No rate limiting exists on auth, OTP, registration or AI. | 0 | ✅ |
| H3 | `requireBatchAccess` only checks `batchId` from params or body. `PUT /homework/:id`, `POST /tests/:id/marks`, `GET /attendance/sessions/:id` and `GET /tests/student/:id` bypass it. | 2 | ✅ |
| H4 | Permissions are frozen in the JWT, so revocation waits for token expiry. `features` is always `[]`. `requireFeature` is only on the AI and risk-engine routes, so an expired subscription doesn't block the rest of the product. | 2 | ✅ |
| H5 | Reset tokens are HS256 with the access secret and reusable. `verifyEmail` accepts any such token and never persists verification. | 2 | ✅ |
| H6 | The in-process event bus is not durable. The standalone worker process registers **zero** subscribers, so events it publishes (e.g. fee reminders) are dropped. | 4 | ⬜ |
| H7 | Fee reminders re-send daily to every overdue installment with no limit, use UTC instead of the coaching's timezone, and load all tenants' installments into memory in one query. | 4 | ⬜ |
| H8 | WhatsApp assistant: conversation state lives in an in-process `Map`. Parents are resolved by `phone contains last-10-digits` across all tenants. No WABA `phone_number_id` → coaching mapping exists. Dedupe via `jobId` is defeated by `removeOnComplete: true`. | 4 | ⬜ |
| H9 | `SmtpEmailAdapter` never sends mail: it returns `SENT` with a fabricated ID even when SMTP is configured. | 5 | ⬜ |

### 🟡 Medium

| ID | Finding | Phase |
|----|---------|-------|
| M1 | No Prisma migrations (`db push` only). RLS, pgvector and a vector (HNSW) index are not part of deploys. | 1 ✅ |
| M2 | Schema gaps: `Salary` has no teacher FK and no unique `(teacher, month, year)`. `FeePlan`, `Salary` and `Expense` lack a `Coaching` FK. No billing invoice/payment table. `AiUsageLog` has no `coachingId`. Nothing enforces a single active subscription. | 3 |
| M3 | Insecure defaults are accepted in production. Without `JWT_*_KEY`, each pod generates its own key, so multi-replica deploys return random 401s. | 0 |
| M4 | Workers start inside the API process as well as in the worker container. | 4 |
| M5 | Gemini 768-d embeddings are zero-padded to 1536. Switching provider silently corrupts retrieval. | 5 |
| M6 | Hard-coded default AI model IDs are outdated. | 5 |
| M7 | 10 MB global JSON limit, base64 uploads, no file-type or size validation. | 2 ✅ |
| M8 | 15 `*.cron.ts` files are stubs that only log. | 5 |

### ⚙️ Infra, CI & frontend

| ID | Finding | Phase |
|----|---------|-------|
| I1 | `docker-compose.yml` sets `JWT_SECRET` (not a config key) with `NODE_ENV=production`, so env validation fails and the API and worker containers don't boot. | 6 |
| I2 | k8s: `:latest` image, no probes or resource limits, no worker deployment, no migration job. | 6 |
| I3 | CI: no ESLint config, no DB-backed tests, no Docker build, no dependency audit or secret scanning. | 6 |
| I4 | No README or runbook. | 6 |
| I5 | Web is a single static dashboard with hard-coded data. Mobile is one `App.tsx`. | 7 |

---

## 2. Phases

### Phase 0: Stop the bleeding
- [x] Central async error forwarding for every router, plus process-level `unhandledRejection` / `uncaughtException` handlers (C1)
- [x] Remove the committed JWT keypair from the repo, ignore `.keys/`, refuse key generation in production (C3, M3)
- [x] Stop logging OTPs and reset tokens outside development. Limit OTP verification attempts (C4)
- [x] Remove the unauthenticated WhatsApp inbound route (C2)
- [x] Fail-closed webhook signature checks in production (C6, part 1)
- [x] `TRUST_PROXY` config, trusted client IP for lockout, Redis-backed rate limiting on public auth routes (H2)
- [x] Reject insecure default secrets in production (M3)
- [ ] **Manual:** rotate any environment that ever used the committed key, and purge `apps/api/.keys` from git history (requires a force-push; coordinate with all clones)

**Exit criteria:** a failed login returns 401 and the process stays up; the inbound route returns 404; the production config refuses default secrets; all unit tests pass.

### Phase 1: Tenant isolation ✅
- [x] Fail-closed tenant extension: tenant-scoped queries with no tenant throw `TENANT_CONTEXT_REQUIRED`; explicit `RequestContextService.runForTenant()` / `runAsSystem()` contexts
- [x] Every Prisma operation scoped (incl. `aggregate`, `groupBy`, `*OrThrow`, `upsert`); writes naming another coaching are refused; `findUnique` keeps `select`/`include`; knowledge-base models registered
- [x] Prisma migrations introduced (baseline + RLS). RLS policies on all 29 tenant tables, `FORCE`d, set per transaction with parameterised `set_config`; interactive transactions keep atomicity (tenant set once on the transaction's connection); HNSW index for RAG search
- [x] Startup refuses (production) or warns (dev) when the DB role is a superuser/BYPASSRLS, since RLS would be skipped; `infra/docker/postgres/create-app-role.sql` creates the application role
- [x] Entrypoints declare their tenant: queue jobs (from `job.data.coachingId`), event subscribers (from `event.coachingId`), payment webhooks (signed notes), WhatsApp inbound (after parent lookup); identity lookup at login, coaching provisioning, delivery receipts and schedulers run as system
- [x] Real-database tests: 14-case isolation suite (both layers, transactions, role check) and an HTTP end-to-end suite; CI `integration` job with Postgres + Redis

**Exit:** met. The isolation suite passes against a real database, and runs in CI.

**Upgrading an existing database** (created with `prisma db push`), as the schema owner:
1. `prisma migrate resolve --applied 20260923000000_init` (mark the baseline as already present)
2. `pnpm prisma:migrate:deploy` (applies RLS and the HNSW index)
3. `psql "$OWNER_URL" -v app_password=... -f infra/docker/postgres/create-app-role.sql`, then point the API's `DATABASE_URL` at `trueco_app`

**Known limitations, tracked for later phases:**
- Relation `connect` to another tenant's row by id is not blocked by RLS (the policy checks the written row, not the referenced one); services must validate referenced ids (Phase 2)
- The WhatsApp parent lookup still matches phone numbers across all tenants (H8, Phase 4)
- Each statement outside an interactive transaction now runs as a small transaction (`set_config` + statement); measure latency under load before scaling (Phase 6)
- `app.rls_bypass` is a session setting: code able to run arbitrary SQL as the app role can set it. RLS guards against missing filters in application code, not against SQL injection

### Phase 2: AuthN / AuthZ correctness ✅
- [x] Teachers confined to their batches on every route that identifies a record: homework, tests and marks, attendance sessions, students, timeline, AI student/teacher endpoints. A teacher request whose batch cannot be determined is refused (was: allowed)
- [x] Roles and permissions re-read from the database on each request (60 s Redis cache, dropped on role assignment and teacher (de)activation); deactivated users get 401 and deactivated teachers lose the teaching role immediately
- [x] One subscription rule (`evaluateSubscriptionAccess`) applied to 20 business modules; lapsed trials and periods get 402 even when the status column was not updated. Auth, coaching profile and billing stay open so a lapsed coaching can pay. Subscription cache is now invalidated on upgrade and expiry (was never invalidated)
- [x] Password reset and email verification use random single-use tokens stored as SHA-256 hashes (`auth_action_tokens`), consumed atomically; email verification is recorded (`users.email_verified_at`); registration issues a verification token. Reset passwords now need 8+ characters, matching registration
- [x] Uploads: per-category type and size limits, content signature check, SVG/HTML refused, file names sanitised; default JSON body limit lowered from 10 MB to 1 MB (uploads 15 MB, bulk import 10 MB)
- [x] Same-tenant references: 23 database triggers reject any link to another coaching's record (Phase 1 leftover)
- [x] Five permission codes used by routes were never seeded (`dashboard:*`, `audit:read`, `ai:manage_credits`, `ai:view_logs`); teachers now receive `dashboard:teacher`
- [x] Prisma not-found / duplicate / invalid-reference errors now return 404 / 409 / 400 instead of 500

**Bugs found and fixed along the way:** batch-wide notifications (homework and test alerts) always failed, and `GET /tests/student/:id` always returned 500. Both queries filtered on a `deletedAt` column those tables do not have.

**Exit:** met. Tests prove a teacher gets 403 on another batch's homework, tests and students; a deactivated teacher loses access on the next request with the same token; a lapsed trial gets 402 while sign-in and billing work; a reset link works once, including under 8 concurrent attempts.

**Upgrading an existing database:** `pnpm prisma:migrate:deploy`, then re-run `pnpm --filter @trueco/api db:seed:rbac` to add the new permissions.

**Known limitations, tracked for later phases:**
- List endpoints (`GET /students`, `/batches`, `/parents`) still return coaching-wide lists to teachers; per-batch filtering belongs in the services
- Marks upload checks the test's batch, but not that each student in the payload belongs to it
- After a password reset, existing access tokens keep working until they expire (up to 15 min); refresh tokens are revoked
- Reset and verification tokens are only printed on a development terminal until email delivery exists (Phase 5)
- Presigned (direct-to-Cloudinary) uploads are checked by declared type only, at the time the URL is issued
- Knowledge-base sync calls the real Gemini API from tests when a key is present in `.env` (Phase 6: stub external providers in tests)

### Phase 3: Money & data integrity
Row locks or conditional updates on payments; `Decimal` arithmetic; per-coaching sequential receipt counters; a `payment_events` table with a unique provider event ID; unique `(coachingId, transactionRef)`; billing invoice and payment tables; salary uniqueness; missing FKs.
**Exit:** concurrency and webhook-replay tests pass.

### Phase 4: Reliable async
Transactional outbox → BullMQ; subscribers registered in the worker; separate API and worker processes; notification idempotency keys; reminder policy (once per stage, coaching's timezone, quiet hours, paged per tenant); WhatsApp state in Redis, `phone_number_id` → coaching routing, inbound message table keyed by `wamid`.

### Phase 5: Real integrations
Nodemailer SMTP; fail instead of simulating when credentials are missing in production; config-driven AI model IDs; embedding model and dimension stored per index; implement or delete stub crons.

### Phase 6: Quality gates & delivery
ESLint with layer-boundary rules; CI with Postgres and Redis services, integration and e2e tests, coverage floor, Docker build, `pnpm audit`, gitleaks; working docker-compose; k8s probes, limits, worker deployment and migration job; README and runbook.

### Phase 7: Frontend
Typed API client on `@trueco/types`, real authentication flow, replace mocked dashboard data.
