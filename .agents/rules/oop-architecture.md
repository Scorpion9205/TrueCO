---
description: Strict Object-Oriented Programming and Clean Architecture Standards for Vargly
globs: "apps/api/**/*.ts,packages/**/*.ts"
always_on: true
---

# Object-Oriented Programming & Clean Architecture Standards

As established by our 15-year Senior Software Engineering leadership, Vargly backend code must be strictly **Object-Oriented**, adhering to SOLID principles and Clean Architecture discipline. Procedural scripting and loose global function patterns are strictly prohibited in domain logic.

---

## 1. Core SOLID Rules

### 1.1 Single Responsibility Principle (SRP)
- Each class has one, and only one, reason to change.
- `Controller`: Translates HTTP requests to DTOs and HTTP responses. Contains no business calculations or DB queries.
- `Validator`: Validates schema, types, and raw input invariants using Zod.
- `Service`: Encapsulates business logic, invariants, and domain rules.
- `Repository`: Encapsulates persistence queries (Prisma). Contains no business rules.
- `Mapper`: Transforms raw DB records to domain entity objects and domain entities to response DTOs.
- `Policy`: Encapsulates user/tenant authorization logic for specific module actions.
- `Subscriber`: Handles reactions to domain events and dispatches asynchronous jobs.

### 1.2 Open-Closed Principle (OCP)
- Core logic is open for extension, closed for modification.
- External systems (WhatsApp, Email, LLM providers, Object Storage) must be designed behind interfaces (`IWhatsAppAdapter`, `IEmailAdapter`, `IAiProvider`, `IStorageService`). New vendors are introduced by implementing new adapter classes, never editing existing domain code.

### 1.3 Liskov Substitution Principle (LSP)
- Derived implementations must be 100% substitutable for their abstract interfaces without side effects.
- In-memory mock repositories used in unit tests (e.g., `InMemoryStudentRepository`) must behave identically to the production `PrismaStudentRepository` in terms of interface contracts.

### 1.4 Interface Segregation Principle (ISP)
- Interfaces must be small, cohesive, and client-specific.
- Prefer `IStudentReader` and `IStudentWriter` or fine-grained repository interfaces over bloated mega-interfaces.

### 1.5 Dependency Inversion Principle (DIP)
- High-level modules (Services) must not depend on low-level modules (Prisma, Express). Both must depend on abstractions.
- All dependencies must be injected into classes via **Constructor Injection**.
- Framework types (`Request`, `Response`, `NextFunction`, `PrismaClient`, Prisma generated model types) must **NEVER** appear in Service class method signatures or domain entities.

---

## 2. Design Patterns Mandated

1. **Repository Pattern**:
   - Every module has an `I<Entity>Repository` interface defined in `shared/interfaces/` or module directory.
   - The concrete repository class implements this interface using Prisma.
2. **Adapter Pattern**:
   - Used for all external I/O:
     - `IWhatsAppAdapter` -> `MetaCloudWhatsAppAdapter`, `MockWhatsAppAdapter`
     - `IEmailAdapter` -> `SmtpEmailAdapter`, `MockEmailAdapter`
     - `IAiProvider` -> `OpenAiAdapter`, `ClaudeAiAdapter`, `GeminiAiAdapter`
     - `IStorageService` -> `S3StorageAdapter`, `LocalStorageAdapter`
3. **Observer / Domain Event Pattern**:
   - Domain operations publish events through a typed `IEventBus`.
   - Dedicated `Subscriber` classes listen and react to events asynchronously.
4. **Strategy Pattern**:
   - Used for fee discount calculations, risk scoring formulas, and reminder rules.
5. **Factory Pattern**:
   - Used in the AI Service Layer and Notification Orchestrator to instantiate appropriate provider adapters based on tenant configuration and plan tier.
6. **Decorator / Middleware Pattern**:
   - Cross-cutting concerns are expressed as declarative TypeScript decorators/middleware:
     - `@RequirePermission('resource:action')`
     - `@RequireFeature('feature_name')`
     - `@RequireBatchAccess()`

---

## 3. Class Structure Conventions

Every class must declare explicit visibility modifiers (`public`, `protected`, `private`, `readonly`):

```typescript
export class StudentService {
  public constructor(
    private readonly studentRepository: IStudentRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: ILogger
  ) {}

  public async enrollStudent(
    dto: EnrollStudentDto,
    context: RequestContext
  ): Promise<StudentDomainEntity> {
    // 1. Verify invariants
    // 2. Perform business mutation
    // 3. Persist via repository
    // 4. Emit domain event
    // 5. Return domain entity
  }
}
```
