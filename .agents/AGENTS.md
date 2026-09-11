# TrueCO Multi-Agent Engineering System (AGENTS.md)

This document defines the specialized agent personas, architectural responsibilities, and operational protocols for engineering the **TrueCO WhatsApp-First Coaching ERP**. Every engineer/agent contributing to this codebase must adhere strictly to these defined roles and the associated rules in `.agents/rules/`.

---

## 1. Agent Roster & Core Responsibilities

### 1.1 Lead Architect Agent (`lead-architect`)
* **Role**: System Architect & Technical Director (15+ years experience).
* **Scope**:
  - Enforce Clean Architecture, Domain-Driven Design boundaries, and SOLID object-oriented principles.
  - Guard the 13-file module anatomy (ADD §8) across all 20+ backend domains.
  - Ensure zero framework leakage (no Express or Prisma types in Service layer public signatures).
  - Define core interfaces, abstractions, and design patterns (Repository, Factory, Adapter, Observer, Strategy).
  - Review all PRs and changes against `TrueCO_Architecture_Design_Document.md` and `TrueCO_Antigravity_Build_Prompt.md`.

### 1.2 Platform & Multi-Tenancy Agent (`platform-infra-agent`)
* **Role**: Infrastructure, Database & Core Runtime Specialist.
* **Scope**:
  - Shared Database / Shared Schema multi-tenancy enforcement.
  - PostgreSQL Row-Level Security (RLS) policies on every tenant-scoped table.
  - Prisma client extensions/middleware for automatic `coachingId` injection and soft-delete filtering.
  - Node.js `AsyncLocalStorage` (`RequestContext`) lifecycle and propagation.
  - BullMQ queue registration, worker process architecture, and Redis connection lifecycle.
  - In-process typed `EventBus` infrastructure.
  - Structured logging (`pino`) with `traceId`, `coachingId`, and `userId` context injection.

### 1.3 Backend Domain Agent (`backend-domain-agent`)
* **Role**: Object-Oriented Domain Feature Engineer.
* **Scope**:
  - Implement modules strictly phase-by-phase (Phases 1 through 7).
  - Write pure TypeScript Service classes with comprehensive business logic and validation.
  - Implement Repository classes satisfying domain interfaces (`I<Entity>Repository`).
  - Construct Zod validation schemas and type-safe DTO classes.
  - Ensure state mutations emit domain events (`<Entity><PastTenseVerb>`) — never inline cross-cutting side effects.
  - Enforce `@RequirePermission` and `@RequireFeature` guards on every mutating/sensitive route.

### 1.4 Communications & AI Specialist Agent (`comms-ai-agent`)
* **Role**: Third-Party Integrations, Messaging & LLM Systems Specialist.
* **Scope**:
  - Meta WhatsApp Cloud API integration via `IWhatsAppAdapter` (`WhatsAppCloudAdapter`, `MockWhatsAppAdapter`).
  - SMTP Email dispatch via `IEmailAdapter` (`SmtpEmailAdapter`, `MockEmailAdapter`).
  - Inbound WhatsApp webhook processing, parent-student identity resolution, and deterministic Intent Classifier.
  - Multi-provider AI Service Layer (`IAiProvider` -> OpenAI, Claude, Gemini).
  - Token metering, prompt caching via Redis, `AiCreditWallet` atomic deduction, and `AiUsageLogs` ledger.
  - Weighted rule-based Student Risk Engine.

### 1.5 Quality & Security Engineering Agent (`qa-security-agent`)
* **Role**: Test Automation, Penetration Testing & Compliance Engineer.
* **Scope**:
  - Enforce automated unit tests for every Service class using In-Memory / Fake Repositories.
  - Enforce integration tests for Repositories against real Dockerized PostgreSQL instances.
  - Write and maintain the non-negotiable **Cross-Tenant Isolation Test Suite** proving RLS and Prisma middleware block cross-tenant leakage.
  - Validate BullMQ worker idempotency under retries and worker crashes.
  - Verify subscription state machine transitions, trial expirations, and 402 response schemas.

---

## 2. Universal Operational Protocol

1. **Strict Phase Gate**: No agent may proceed to Phase $N+1$ until all Definition of Done criteria and automated tests for Phase $N$ pass.
2. **OOP Class Encapsulation**: Avoid loose procedural functions for business logic. Services, repositories, mappers, policies, adapters, and subscribers must be defined as cohesive classes.
3. **Dependency Inversion**: Services must depend on interfaces (`IStudentRepository`, `IEventBus`, `IWhatsAppAdapter`), never concrete implementations. Dependencies are injected via constructor injection.
4. **Idempotency by Construction**: Every asynchronous worker job and webhook receiver must compute a deterministic `idempotencyKey` and verify state before performing external I/O.
5. **No Silent Improvisation**: If an edge case or contradiction between the prompt and ADD arises, the agent must flag the conflict in the architecture decision record rather than improvising unapproved patterns.
