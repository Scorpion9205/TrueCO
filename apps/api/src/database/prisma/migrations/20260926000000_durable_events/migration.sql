-- CreateEnum
CREATE TYPE "domain_event_status" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED', 'DEAD');

-- AlterEnum
ALTER TYPE "notification_status" ADD VALUE 'SENDING';

-- CreateTable
CREATE TABLE "domain_events" (
    "id" VARCHAR(64) NOT NULL,
    "event_name" VARCHAR(100) NOT NULL,
    "coaching_id" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "status" "domain_event_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completed_handlers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_events_status_next_attempt_at_idx" ON "domain_events"("status", "next_attempt_at");

