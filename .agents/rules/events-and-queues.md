---
description: Domain Events, BullMQ Queues, and Asynchronous Worker Rules
globs: "apps/api/src/events/**/*.ts,apps/api/src/queues/**/*.ts,apps/api/src/workers/**/*.ts"
always_on: true
---

# Domain Events & Queue Processing Rules

To maintain high API performance (p95 < 150ms) and system resilience, all side effects and I/O-heavy operations are decoupled through **Domain Events** and **BullMQ Queues**.

---

## 1. Domain Event Rules

1. **Naming Convention**: `<Entity><PastTenseVerb>` (e.g. `AttendanceMarked`, `FeePaid`, `TestResultReady`, `HomeworkCreated`).
   - *Never* use imperative commands (`MarkAttendance` is a command, not an event).
2. **Payload Structure**:
   ```typescript
   export interface DomainEvent<T = unknown> {
     readonly eventId: string;
     readonly eventName: string;
     readonly coachingId: string;
     readonly occurredAt: Date;
     readonly payload: T;
     readonly metadata: {
       readonly correlationId: string;
       readonly userId?: string;
     };
   }
   ```
3. **Event Bus Implementation**:
   - Uses an in-process, strongly-typed `IEventBus` with compile-time type checking for subscribers.
   - Domain services emit events synchronously after their database transaction commits; event dispatching must never abort the primary business transaction.

---

## 2. Queue Architecture (BullMQ)

### 2.1 Standard Queues
| Queue | Purpose | Priority | Backoff Policy |
|---|---|---|---|
| `whatsapp-queue` | Meta Cloud API message sends | High | 5 attempts, exponential (5s base) |
| `email-queue` | SMTP email dispatch | Medium | 5 attempts, exponential (5s base) |
| `reminder-queue` | Timezone-aware scheduled reminders | Medium | 3 attempts, exponential (10s base) |
| `pdf-queue` | Fee receipts and report PDF generation | Medium | 3 attempts, fixed (5s) |
| `report-queue` | Heavy background report generation | Low | 2 attempts, exponential (30s base) |
| `ai-queue` | OpenAI / Claude / Gemini API invocations | Low / Med | 3 attempts, exponential (10s base) |
| `import-queue` | Bulk Excel file imports | Low | 1 attempt (fail fast with error report) |
| `analytics-queue`| Nightly student risk and attendance rollups | Lowest | 3 attempts, exponential |
| `cleanup-queue`  | Soft-deleted data retention purge | Lowest | 3 attempts, exponential |

### 2.2 Workers as Isolated Processes
- Workers in `apps/api/src/workers/` compile to separate entrypoints and run in isolated Docker containers / Kubernetes pods.
- Heavy background jobs (e.g., PDF generation, AI calls, Excel imports) must **NEVER** compete for CPU/memory with the HTTP API server.

---

## 3. Worker Idempotency & Fault Tolerance

1. **Deterministic Idempotency Key**:
   - Every queue job MUST carry a deterministic `idempotencyKey`:
     `format: {domain}:{operation}:{entityId}:{timestamp_or_version}`
     *(e.g., `whatsapp:fee_receipt:trans_98124:v1`)*
2. **Pre-flight State Verification**:
   - Before dispatching external requests (Meta API, SMTP, LLM), the worker MUST verify `NotificationHistory` or the target entity state in PostgreSQL.
   - If the action has already been performed or marked as `SENT`/`PROCESSED`, the job returns immediately as a no-op.
3. **Dead Letter Queue (DLQ)**:
   - Exhausted jobs automatically divert to `*-dlq`.
   - Surfaced to the Owner via the "Retry Failed Messages" API and dashboard panel.
4. **Per-Tenant Rate Limiting**:
   - Worker concurrency uses BullMQ job grouping per `coachingId` so that a large broadcast from one coaching institute cannot starve transactional messages of another.
