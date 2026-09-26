# Vargly

WhatsApp-first management platform for coaching institutes: students, batches, attendance, tests, homework, fees, salaries and parent communication over WhatsApp and email, with an AI assistant that answers parents from each institute's own data.

## Repository

| Path | What it is |
| --- | --- |
| `apps/api` | Node.js API and background workers (Express, Prisma, PostgreSQL, Redis/BullMQ) |
| `apps/web` | Next.js dashboard (early) |
| `apps/mobile` | Expo app (early) |
| `packages/types` | Types shared by the apps |
| `infra/docker` | Container image, local production-mode stack |
| `infra/k8s` | Kubernetes manifests (Kustomize) |
| `docs/` | Architecture, [audit and remediation plan](docs/AUDIT_AND_REMEDIATION_PLAN.md), [runbook](docs/RUNBOOK.md) |
| `.agents/rules/` | Architecture rules every change follows |

## Key design points

- **Multi-tenant with two isolation layers.** Every coaching's data is confined by the application (a Prisma extension that refuses queries without a tenant) and by PostgreSQL row-level security. The API must connect as a non-superuser role, or RLS does nothing; production refuses to start otherwise.
- **Durable side effects.** Domain events are recorded before their handlers run, and failed handlers are retried by the worker.
- **Money is exact and recorded once.** Payments lock the installment row, amounts use decimals, and webhook retries are deduplicated.

## Prerequisites

Node.js 22, pnpm 11 (`corepack enable`), Docker.

## Local development

```bash
pnpm install

# Database and Redis in Docker
pnpm docker:env                        # once: writes infra/docker/compose.env with generated secrets
docker compose --env-file infra/docker/compose.env -f infra/docker/docker-compose.yml up -d postgres redis

# Migrations and roles/permissions/plans, as the schema owner (POSTGRES_PASSWORD from compose.env)
export OWNER_URL="postgresql://vargly_owner:<POSTGRES_PASSWORD>@localhost:5433/vargly_db?schema=public"
DATABASE_URL="$OWNER_URL" pnpm prisma:migrate:deploy
DATABASE_URL="$OWNER_URL" pnpm --filter @vargly/api db:seed:rbac

# API configuration: DATABASE_URL uses vargly_app / APP_DB_PASSWORD from compose.env
cp apps/api/.env.example apps/api/.env

pnpm --filter @vargly/api dev          # API on :4000; in development it also runs the workers
```

Without SMTP, WhatsApp or payment credentials, development simulates sending and logs it. Production fails instead of pretending; the startup log lists which integrations are live.

To run the whole stack in production mode (API, worker, migrations, queue dashboard on :3001):

```bash
pnpm docker:env && pnpm docker:up
```

## Tests and checks

```bash
pnpm run lint
pnpm run test:unit

# Integration tests need a migrated database, the app role and Redis (CI does this automatically)
TEST_DATABASE_OWNER_URL=... TEST_DATABASE_URL=... DATABASE_URL=... REDIS_PORT=... pnpm run test:integration
```

Tests never read `apps/api/.env`, so real API keys there are never used by a test run.

CI runs lint, unit and integration tests, a secret scan, a dependency audit, the Docker build, and the compose and Kubernetes manifest checks.

## Deploying

See the [runbook](docs/RUNBOOK.md): required secrets, the migration job, rollout order, alerts, and how to handle failed events and payments that need reconciliation.
