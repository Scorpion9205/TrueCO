---
description: Mandatory 13-File Module Structure and Layer Isolation Rules
globs: "apps/api/src/modules/**/*.ts"
always_on: true
---

# Module Structure & Layer Separation Rules

Every backend bounded-context module located under `apps/api/src/modules/<name>/` MUST follow the exact 13-file architecture specified in ADD §8. Deviation is strictly prohibited.

---

## 1. The 13-File Module Anatomy

```
apps/api/src/modules/<module-name>/
├── <module-name>.controller.ts      # HTTP layer: extracts params/body, delegates to service, formats HTTP response
├── <module-name>.routes.ts          # Express Router definition with middleware and decorators
├── dto/                             # Data Transfer Objects (Plain TS classes or interfaces)
│   ├── create-<entity>.dto.ts
│   └── <entity>-response.dto.ts
├── validators/                      # Zod validation schemas validating input and generating DTO types
│   └── <module-name>.validator.ts
├── <module-name>.service.ts         # Domain business logic (Pure TS class, ZERO Express/Prisma types in signatures)
├── <module-name>.repository.ts      # Prisma query implementation adhering to I<Entity>Repository
├── <module-name>.mapper.ts          # Entity <-> DTO <-> Prisma model bidirectional transformations
├── <module-name>.policy.ts          # Module-specific authorization and capability evaluation rules
├── <module-name>.events.ts          # Domain event definitions emitted by this module (<Entity><PastTenseVerb>)
├── <module-name>.subscribers.ts     # Domain event handlers listening to events from other modules
├── <module-name>.jobs.ts            # BullMQ job producers specific to this module
├── <module-name>.cron.ts            # (Optional/empty if none) Repeatable scheduled jobs registered with BullMQ
└── <module-name>.module.ts          # Composition Root: instantiates repo, service, controller, and registers routes/events
```

---

## 2. Strict Layer Isolation Rules

| Component | Allowed Framework Imports | Forbidden Imports | Responsibilities |
|---|---|---|---|
| **Controller** | `express`, `http-status-codes` | Prisma models, direct DB drivers | Parse HTTP req, call Service, send HTTP res. |
| **Routes** | `express`, middlewares, decorators | Direct DB drivers | Attach routes to Express Router with RBAC & validation. |
| **Service** | Pure TypeScript, domain errors, domain entities | `express` types, `PrismaClient`, generated Prisma models | Enforce domain invariants, execute business operations, emit domain events. |
| **Repository** | `PrismaClient`, `@prisma/client` | `express` types | Perform database queries, map DB rows to domain entities. |
| **Mapper** | Pure TypeScript, domain entities, DTOs | `express` types | Transform data across layer boundaries. |
| **Policy** | Pure TypeScript, user/tenant context | Direct DB drivers, `express` types | Evaluate data-level permissions (e.g. `@RequireBatchAccess`). |
| **Subscribers** | Domain event bus, BullMQ queues | `express` types | Listen to domain events and enqueue asynchronous background jobs. |

---

## 3. Cross-Module Communication Law

1. **NO Cross-Module Repository Imports**: Module A may NEVER import `ModuleBRepository` or access Module B's Prisma models directly.
2. **Asynchronous Decoupling**: Side effects (notifications, audit, timeline, risk scoring) must be triggered exclusively by publishing domain events.
3. **Synchronous Facades**: If Module A needs synchronous data from Module B, Module B must expose a public Facade/QueryService interface (`IModuleBFacade`) registered in `shared/interfaces/`.
