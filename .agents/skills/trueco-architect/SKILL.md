---
name: trueco-architect
description: >-
  Lead Architect playbook for scaffolding TrueCO Clean Architecture modules, 
  implementing OOP services, in-memory test fakes, Prisma repositories, and verifying phase completion.
---

# TrueCO Senior Architect Playbook

This skill provides step-by-step guidance for engineers and subagents implementing TrueCO backend modules, maintaining strict Object-Oriented Clean Architecture, and executing each phase according to the specification.

---

## 1. Module Scaffolding Workflow

When building any module `apps/api/src/modules/<module-name>/`:

1. **Define Domain Entities & Repository Interface** (`shared/interfaces/` or module-level):
   - Declare `I<Entity>Repository` with methods returning plain TypeScript domain entities, never Prisma types.
2. **Define DTOs & Zod Validators** (`dto/` and `validators/`):
   - Zod schema enforces input types, lengths, email formats, and strict unknown field rejection (`.strict()`).
   - Extract TypeScript types directly: `export type CreateDto = z.infer<typeof createSchema>;`.
3. **Implement Domain Service Class** (`<module-name>.service.ts`):
   - Pure OOP class with constructor injection.
   - Depends only on `I<Entity>Repository`, `IEventBus`, and `ILogger`.
   - Contains zero Express or Prisma imports in public signatures.
   - Emits `<Entity><PastTenseVerb>` domain event upon successful mutation.
4. **Implement Prisma Repository Class** (`<module-name>.repository.ts`):
   - Implements `I<Entity>Repository`.
   - Executes queries via `PrismaClient`.
   - Uses `<module-name>.mapper.ts` to convert between Prisma database records and domain entities.
5. **Implement Controller & Router** (`<module-name>.controller.ts` & `<module-name>.routes.ts`):
   - Controller handles HTTP payload extraction, calls Service, and returns formatted `{ data, meta }` response.
   - Router defines routes decorated with `@RequirePermission` and `@RequireFeature`.
6. **Implement Module Composition Root** (`<module-name>.module.ts`):
   - Wires repository instance into service instance.
   - Registers event subscribers and exportable facade functions.

---

## 2. Unit Testing Pattern with Fake In-Memory Repositories

Every service must have a unit test suite using an in-memory repository to guarantee fast, hermetic testing without database overhead:

```typescript
export class InMemoryStudentRepository implements IStudentRepository {
  private readonly items: Map<string, StudentDomainEntity> = new Map();

  public async findById(id: string, coachingId: string): Promise<StudentDomainEntity | null> {
    const item = this.items.get(id);
    return item && item.coachingId === coachingId ? item : null;
  }

  public async save(entity: StudentDomainEntity): Promise<void> {
    this.items.set(entity.id, entity);
  }
}
```

---

## 3. Phase Completion Verification Checklist

Before certifying a phase as complete:
1. **Compilation**: `pnpm build` passes with zero TypeScript errors across monorepo.
2. **Linting**: Code passes ESLint without style or naming violations.
3. **Unit Tests**: All domain service unit tests pass using mock/fake repositories.
4. **Integration Tests**: Repository tests pass against real PostgreSQL.
5. **Event Emission**: Passing tests prove required domain events fire and subscribers trigger correctly.
6. **RLS Verification**: Negative-path tests prove cross-tenant access is blocked at both Prisma and PostgreSQL levels.
