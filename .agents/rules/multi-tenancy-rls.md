---
description: Multi-Tenancy, Row-Level Security (RLS), and Tenant Scoping Rules
globs: "apps/api/**/*.ts,packages/**/*.ts,infra/**/*.sql"
always_on: true
---

# Multi-Tenancy & Row-Level Security Rules

Multi-tenancy isolation is non-negotiable. Vargly employs a **Shared Database, Shared Schema** architecture with strict three-tier defense-in-depth isolation:

---

## 1. Universal Columns & Schema Standards

Every tenant-scoped Prisma model must include the universal columns (ADD §6.1):
```prisma
id          String    @id @default(uuid()) @db.Uuid
coachingId  String    @db.Uuid @map("coaching_id")
createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz()
updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz()
deletedAt   DateTime? @map("deleted_at") @db.Timestamptz()
createdBy   String?   @db.Uuid @map("created_by")
updatedBy   String?   @db.Uuid @map("updated_by")
```
Only platform-level tables (e.g., `PlatformAdmin`, global `Plan`, global `FeatureFlag`) omit `coachingId`.

---

## 2. Three-Tier Isolation Mechanism

### Tier 1: Request Context via `AsyncLocalStorage`
- The `TenantContextMiddleware` extracts `coachingId`, `userId`, `roles`, and `permissions` from the verified JWT.
- It binds these details into Node's `AsyncLocalStorage` instance (`RequestContextService`).
- Service and repository layers access the active `coachingId` without manual argument threading.

### Tier 2: Prisma Client Auto-Filtering Middleware / Extension
- All read queries (`findUnique`, `findFirst`, `findMany`, `count`, `aggregate`) automatically append:
  - `coachingId: currentTenantId`
  - `deletedAt: null` (soft-delete enforcement)
- All create/update operations automatically inject:
  - `coachingId: currentTenantId`
  - `createdBy` / `updatedBy`
- Engineers cannot bypass tenant-scoping even if they forget a `where` clause in code.

### Tier 3: PostgreSQL Row-Level Security (RLS)
- Every tenant-scoped table has PostgreSQL RLS enabled:
  ```sql
  ALTER TABLE students ENABLE ROW LEVEL SECURITY;
  ALTER TABLE students FORCE ROW LEVEL SECURITY;

  CREATE POLICY tenant_isolation_policy ON students
    FOR ALL
    USING (coaching_id = NULLIF(current_setting('app.current_coaching_id', true), '')::uuid);
  ```
- Before executing queries within a request, the database session sets `SET LOCAL app.current_coaching_id = '<coachingId>'`.
- Even in the event of an application-level bug or raw `$queryRaw`, RLS enforces a hard fail-closed barrier at the Postgres engine level.

---

## 3. Storage & Cache Partitioning

- **Redis Keys**: Must always be tenant-prefixed: `tenant:{coachingId}:{module}:{key}`.
- **S3 Object Keys**: Must always be tenant-prefixed: `coaching/{coachingId}/{resource}/{fileId}`.
- Direct bucket access is strictly forbidden; all uploads and downloads must be brokered via short-lived signed URLs generated server-side following authorization.

---

## 4. Mandatory Verification Test
- Phase 1 must include an automated negative-path integration test:
  - Create Tenant A and Tenant B.
  - User A attempts to read/mutate an entity belonging to Tenant B.
  - The query must return 404 (or empty set) and fail to modify data, proving RLS and middleware isolate tenants completely.
