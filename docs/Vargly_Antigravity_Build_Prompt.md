# Antigravity Build Prompt — Vargly

Paste this into Antigravity as your project brief. It references `Vargly_Architecture_Design_Document.md` — upload/attach that file alongside this prompt so the agent has the full spec in context.

---

```
You are acting as a senior full-stack engineering team implementing Vargly, a
WhatsApp-first Coaching Management SaaS ERP, strictly following the attached
Architecture Design Document (Vargly_Architecture_Design_Document.md).

Do not deviate from the architecture document's decisions (tech stack, module
structure, multi-tenancy model, event-driven design, naming conventions)
unless something in it is genuinely impossible to implement as written — if
so, stop and flag the conflict instead of silently improvising.

===========================================================
GLOBAL RULES
===========================================================
1. Tech stack is fixed: Node.js + TypeScript, Express, Prisma, PostgreSQL,
   Redis, BullMQ, S3-compatible storage, JWT (RS256) + Argon2id, Zod, REST +
   OpenAPI, Next.js (web), React Native (mobile). Do not substitute
   frameworks (no NestJS, no tRPC, no MongoDB) without asking first.
2. Follow the exact monorepo folder structure in ADD §7 (apps/api,
   apps/web, apps/mobile, packages/types, packages/ui, infra/*).
3. Every backend module MUST follow the ADD §8 module shape exactly:
   controller / routes / dto / validators / service / repository / mapper /
   policy / events / subscribers / jobs / cron / module.ts. The service layer
   must never import Express or Prisma types in its public signatures.
4. Multi-tenancy: every tenant-scoped Prisma model has coachingId; implement
   the Prisma middleware that auto-injects coachingId filtering (ADD §5.2)
   and enable PostgreSQL Row-Level Security on every tenant-scoped table.
   Write an automated test that proves a cross-tenant query is blocked.
5. Every table gets the universal columns from ADD §6.1 (id, coachingId,
   createdAt, updatedAt, deletedAt, createdBy, updatedBy) except explicitly
   platform-level tables. Implement soft-delete via Prisma middleware.
6. State changes are events, not inline side effects. Any write that should
   trigger notification/audit/timeline/risk-scoring MUST emit a domain event
   (ADD §10) and let subscribers handle the side effect — never call the
   WhatsApp/Email/Audit code directly from a domain service.
7. All async/slow work goes through the BullMQ queues defined in ADD §11 —
   nothing that calls WhatsApp, Email, an AI provider, or generates a
   PDF/report should run synchronously inside an HTTP request handler.
8. Every queue job must be idempotent (deterministic idempotencyKey, checked
   before executing side effects) and configured with retry + backoff per
   ADD §11.2.
9. RBAC (ADD §9) is enforced via @RequirePermission and @RequireFeature
   decorators/middleware on every route — no route should skip this except
   explicitly public ones (login, webhook receivers).
10. Subscription/feature-flag enforcement (ADD §19) is the SINGLE choke
    point via loadSubscriptionState middleware + @RequireFeature — do not
    duplicate plan-checking logic inside individual services.
11. Follow the naming conventions in ADD §26 exactly (file names, DTO names,
    event names, queue names) — this consistency matters more than any
    individual naming preference the agent might otherwise default to.
12. Write unit tests (service layer, fake repositories), repository tests
    (real Dockerized Postgres), and integration tests (controller → DB →
    event subscriber) for every module as you build it — not as a separate
    pass at the end.

===========================================================
BUILD ORDER (do not skip ahead — each phase should be working and tested
before starting the next)
===========================================================

PHASE 0 — Foundations
- Initialize the monorepo (apps/api, apps/web, apps/mobile, packages/types,
  packages/ui, packages/config, infra/docker, infra/k8s, .github/workflows)
  per ADD §7.
- Set up TypeScript, ESLint (with custom rules enforcing ADD §26 naming and
  the module folder shape), Prettier, shared tsconfig via packages/config.
- Set up Prisma + PostgreSQL locally via Docker Compose; implement the
  universal-columns Prisma middleware and the tenant-scoping middleware
  (ADD §5.2, §6.1) before building any real module — every future module
  depends on both.
- Implement the internal typed Event Bus (ADD §10) and the BullMQ queue
  registration pattern (ADD §11) as shared infrastructure.
- Implement the AsyncLocalStorage-based request context for coachingId
  propagation (ADD §5.2).
- Set up structured logging (pino) with requestId/coachingId/userId context
  injection (ADD §23.2).

PHASE 1 — Identity, Tenancy & RBAC
- Modules: auth, rbac, coaching.
- Implement JWT (RS256) issuance, Argon2id hashing, refresh-token rotation
  with reuse-detection revocation, account lockout via Redis sliding window,
  logout-all-devices, password reset, email verification (ADD §20.2).
- Implement Users/Roles/Permissions/RolePermissions/UserRoles schema and the
  @RequirePermission decorator + permission-loading middleware (ADD §9).
- Implement Coaching creation flow, including auto-creating a TRIALING
  Subscription with trialEndsAt = now()+60d and the full feature bundle
  unlocked (ADD §19.2).
- Write the cross-tenant-isolation automated test here — it must pass before
  any other module is built on top of this foundation.

PHASE 2 — Core Academic Domain
- Modules: students, parents, teachers, batches, attendance, homework, tests.
- Implement the full schema from ADD §6.2/§6.3 for this group, including the
  StudentParents, BatchStudents (with joinedAt/leftAt), TeacherBatches
  many-to-many tables and their composite/partial unique constraints.
- Implement AttendanceSession → AttendanceRecord flow and Test → TestResult
  upsert-by-(testId,studentId) flow exactly as described in ADD §6.3/§20.3.
- Emit AttendanceMarked, HomeworkCreated, HomeworkUpdated, TestCreated,
  MarksUploaded, TestResultReady events (ADD §10.2) — do not implement
  notification/timeline/audit logic inside these modules; only emit events.

PHASE 3 — Notifications, Timeline & Audit (the cross-cutting subscribers)
- Modules: notifications (Notification Orchestrator), timeline, audit.
- Implement the WhatsApp adapter (Meta Cloud API) and Email adapter (SMTP)
  behind IWhatsAppAdapter/IEmailAdapter interfaces (ADD §13/§14).
- Implement whatsapp-queue and email-queue workers with idempotency,
  retry/backoff, DLQ, and per-tenant rate limiting (ADD §11).
- Implement the generic TimelineSubscriber and AuditSubscriber that listen
  to the full event catalog and normalize entries (ADD §10.3, §18) — this
  is what makes Phase 2's modules "just work" for timeline/audit once wired.
- Implement WhatsApp/Email webhook handlers for delivery status
  (sent/delivered/read/failed) updating NotificationHistory, with the
  Owner-facing "Retry Failed Messages" panel API.
- NOW go back and wire Phase 2's events to this orchestrator — confirm
  attendance/homework/test actions actually produce WhatsApp/Email sends.

PHASE 4 — Fees, Salary, Expenses & Billing
- Modules: fees, salary, expenses, billing (Plans/Subscriptions/
  FeatureFlags/CoachingFeatureOverrides/Coupons/Invoices).
- Implement FeePlan → FeeInstallment → FeeTransaction with partial payment,
  discount, waiver, installment support (ADD §20.3).
- Implement the Reminder Scheduler (ADD §12) as BullMQ repeatable jobs,
  timezone-aware per coaching, reading ReminderRules against the partial
  index on pending FeeInstallments (ADD §6.4).
- Implement full Subscription lifecycle: trial → active/past_due/grace →
  expired, the loadSubscriptionState middleware, @RequireFeature guard, and
  the 402 upgrade-prompt response shape (ADD §19.2). Write end-to-end tests
  for trial expiry, grace period read-only behavior, and reactivation.
- Implement receipt/invoice PDF generation via pdf-queue.

PHASE 5 — Reports, Notice Board, Dashboard, Settings, Reminder Center UI,
Import
- Modules: reports, notice-board, dashboard, settings, import.
- Implement report-queue-backed report generation (attendance/fees/expenses/
  income/growth/monthly) per ADD §11.
- Implement bulk Excel import (students/teachers/batches/fees) with
  background processing, per-row validation, partial-success reporting, and
  transactional-batch rollback (ADD §25, §30).
- Implement per-coaching Settings (logo, theme, WhatsApp config, SMTP,
  branding, timezone, language, currency, academic year) as JSONB config.

PHASE 6 — Smart WhatsApp Assistant & Risk Engine
- Modules: whatsapp-assistant, risk-engine.
- Implement inbound webhook → identity resolution (phone → parent →
  student, with disambiguation for multi-child parents) → rule-based
  IntentClassifier → per-module read-only query services → templated reply
  (ADD §15). Keep this on the free tier, not gated by AI credits.
- Implement the weighted rule-based risk scoring engine (ADD §17),
  event-driven recompute plus nightly full recompute, RiskDetected
  notification wiring through the existing Notification Orchestrator.

PHASE 7 — AI Service Layer (Premium)
- Module: ai.
- Implement the AI Service Layer with IAiProvider abstraction, adapters for
  OpenAI/Claude/Gemini, prompt template storage, Redis response caching
  keyed by (tenantId, feature, inputDataHash), and the
  SubscriptionGuard + AiCreditService enforcement chain (ADD §16).
- Implement AI Monthly Progress Summary, AI Parent Reports, AI Teacher
  Performance Analysis, AI Batch Analytics, AI Attendance/Fee Insights, AI
  Message/Reply Generator — each as a thin module calling the AI Service
  Layer, never calling a provider SDK directly.
- Wire ai-queue worker, credit deduction + AiUsageLogs ledger, and the
  distinct "out of credits" vs "feature not on plan" response states.

PHASE 8 — Frontend (Next.js Owner/Teacher Web) & Mobile (React Native)
- Build the Owner and Teacher dashboards against the API built in Phases
  1–7, using packages/types for shared contracts.
- Implement role-appropriate views per ADD's Admin Features / Teacher
  Features lists (dashboard, students, teachers, batches, attendance,
  homework, tests, reports, fees, salary, expenses, reminder center, audit
  logs, settings, notification history for Owner; dashboard, assigned
  batches, attendance, homework, tests, marks, remarks, student performance
  for Teacher).
- Build the same core flows in React Native for mobile.

PHASE 9 — Deployment & Observability
- Write Dockerfiles per ADD §27.2 (separate images: api, web, worker-*,
  scheduler).
- Write Kubernetes manifests/Helm charts per ADD §27.3 (Deployments,
  Services, Ingress, ConfigMaps, Secrets, HPA on queue depth for workers,
  readiness/liveness probes, Recreate strategy for scheduler singleton).
- Write the GitHub Actions pipeline per ADD §27.4 (lint → unit → integration
  → build → docker → security scan → push → deploy staging → smoke test →
  manual approval → deploy production → rollback on failure).
- Set up Prometheus/Grafana/Loki/OpenTelemetry per ADD §23.1, and the
  backup/PITR strategy per ADD §23.3.

===========================================================
DEFINITION OF DONE FOR EACH PHASE
===========================================================
- All new Prisma models migrated, with RLS policies where tenant-scoped.
- All new routes have Zod validation, permission decorators, and (where
  applicable) feature-flag decorators.
- All new state-changing actions emit the correct domain event(s) and have
  a passing test proving the relevant subscriber(s) fired.
- Unit + repository + integration tests passing in CI for everything built
  in the phase.
- No module in this phase imports another module's repository or service
  directly — only via events or an explicitly exported module facade.

Confirm your understanding of this build order and the module-shape rules
above, then start with PHASE 0. After each phase, summarize what was built,
what tests were added, and explicitly flag any point where you deviated
from the Architecture Design Document and why.
```
