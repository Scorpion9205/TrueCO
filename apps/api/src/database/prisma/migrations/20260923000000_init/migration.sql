-- Baseline: full schema as of the Phase 1 introduction of migrations (previously managed with `prisma db push`).
-- pgvector must exist before coaching_knowledge_chunks.embedding is created.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "role_type" AS ENUM ('SUPER_ADMIN', 'OWNER', 'TEACHER');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "plan_code" AS ENUM ('STARTER', 'PRO_AI', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "fee_installment_status" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'WAIVED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "risk_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ai_provider_type" AS ENUM ('OPENAI', 'CLAUDE', 'GEMINI');

-- CreateEnum
CREATE TYPE "knowledge_base_type" AS ENUM ('FAQ', 'POLICY', 'SYLLABUS', 'SCHEDULE', 'GENERAL_NOTICE');

-- CreateTable
CREATE TABLE "coachings" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "logo_url" TEXT,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "coachings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "coaching_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "coaching_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "family" VARCHAR(255) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "user_agent" TEXT,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_name" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "roll_number" VARCHAR(50),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "gender" VARCHAR(20),
    "dob" DATE,
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "address" TEXT,
    "joining_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parents" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255),
    "relation" VARCHAR(50) NOT NULL DEFAULT 'FATHER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_parents" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "parent_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "specialization" VARCHAR(255),
    "monthly_salary" DECIMAL(12,2),
    "joining_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(100),
    "academic_year" VARCHAR(50) NOT NULL,
    "start_time" VARCHAR(20),
    "end_time" VARCHAR(20),
    "days_of_week" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_students" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_batches" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "session_date" DATE NOT NULL,
    "slot" VARCHAR(50),
    "marked_by_id" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "attendance_status" NOT NULL DEFAULT 'PRESENT',
    "remarks" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "test_date" DATE NOT NULL,
    "total_marks" DECIMAL(6,2) NOT NULL,
    "passing_marks" DECIMAL(6,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "marks_obtained" DECIMAL(6,2) NOT NULL,
    "is_absent" BOOLEAN NOT NULL DEFAULT false,
    "remarks" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "attachment_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_plans" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "discount_type" "discount_type",
    "discount_value" DECIMAL(12,2),
    "final_amount" DECIMAL(12,2) NOT NULL,
    "academic_year" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "fee_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_installments" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "fee_plan_id" UUID NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "due_date" DATE NOT NULL,
    "status" "fee_installment_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "fee_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_transactions" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "payment_method" NOT NULL DEFAULT 'CASH',
    "transaction_ref" VARCHAR(100),
    "receipt_number" VARCHAR(100) NOT NULL,
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "fee_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salaries" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ,
    "payment_method" "payment_method",
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "payment_method" "payment_method" NOT NULL DEFAULT 'CASH',
    "receipt_url" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_history" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "recipient_type" VARCHAR(50) NOT NULL,
    "template_name" VARCHAR(100),
    "content" TEXT NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'QUEUED',
    "provider_message_id" VARCHAR(255),
    "error_message" TEXT,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_timeline" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "summary" TEXT NOT NULL,
    "reference_id" UUID,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_scores" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "level" "risk_level" NOT NULL DEFAULT 'LOW',
    "attendance_factor" DECIMAL(5,2) NOT NULL,
    "marks_factor" DECIMAL(5,2) NOT NULL,
    "fee_factor" DECIMAL(5,2) NOT NULL,
    "homework_factor" DECIMAL(5,2) NOT NULL,
    "narrative" TEXT,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" "plan_code" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_yearly" DECIMAL(10,2) NOT NULL,
    "default_features" TEXT[],
    "default_credits" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'TRIALING',
    "trial_starts_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trial_ends_at" TIMESTAMPTZ NOT NULL,
    "current_period_start" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "grace_period_ends_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_credit_wallets" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "total_allocated" INTEGER NOT NULL DEFAULT 0,
    "total_consumed" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "feature" VARCHAR(100) NOT NULL,
    "provider" "ai_provider_type" NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "credits_deducted" INTEGER NOT NULL,
    "input_hash" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "batch_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "target_audience" VARCHAR(50) NOT NULL DEFAULT 'ALL',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_knowledge_bases" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "type" "knowledge_base_type" NOT NULL DEFAULT 'FAQ',
    "description" TEXT,
    "source_url" TEXT,
    "raw_content" TEXT NOT NULL,
    "character_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "coaching_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_knowledge_chunks" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "knowledge_base_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "embedding" vector(1536),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coaching_knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coachings_code_key" ON "coachings"("code");

-- CreateIndex
CREATE INDEX "users_coaching_id_phone_idx" ON "users"("coaching_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_coaching_id_email_key" ON "users"("coaching_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_coaching_id_code_key" ON "roles"("coaching_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_roles_coaching_id_user_id_idx" ON "user_roles"("coaching_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_coaching_id_key" ON "user_roles"("user_id", "role_id", "coaching_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_family_idx" ON "refresh_tokens"("user_id", "family");

-- CreateIndex
CREATE INDEX "audit_logs_coaching_id_entity_name_entity_id_idx" ON "audit_logs"("coaching_id", "entity_name", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_coaching_id_created_at_idx" ON "audit_logs"("coaching_id", "created_at");

-- CreateIndex
CREATE INDEX "students_coaching_id_roll_number_idx" ON "students"("coaching_id", "roll_number");

-- CreateIndex
CREATE INDEX "students_coaching_id_phone_idx" ON "students"("coaching_id", "phone");

-- CreateIndex
CREATE INDEX "students_coaching_id_created_at_idx" ON "students"("coaching_id", "created_at");

-- CreateIndex
CREATE INDEX "parents_coaching_id_phone_idx" ON "parents"("coaching_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "parents_coaching_id_phone_key" ON "parents"("coaching_id", "phone");

-- CreateIndex
CREATE INDEX "student_parents_coaching_id_student_id_idx" ON "student_parents"("coaching_id", "student_id");

-- CreateIndex
CREATE INDEX "student_parents_coaching_id_parent_id_idx" ON "student_parents"("coaching_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_parents_student_id_parent_id_key" ON "student_parents"("student_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_user_id_key" ON "teachers"("user_id");

-- CreateIndex
CREATE INDEX "teachers_coaching_id_phone_idx" ON "teachers"("coaching_id", "phone");

-- CreateIndex
CREATE INDEX "batches_coaching_id_is_active_idx" ON "batches"("coaching_id", "is_active");

-- CreateIndex
CREATE INDEX "batch_students_coaching_id_batch_id_idx" ON "batch_students"("coaching_id", "batch_id");

-- CreateIndex
CREATE INDEX "batch_students_coaching_id_student_id_idx" ON "batch_students"("coaching_id", "student_id");

-- CreateIndex
CREATE INDEX "teacher_batches_coaching_id_teacher_id_idx" ON "teacher_batches"("coaching_id", "teacher_id");

-- CreateIndex
CREATE INDEX "teacher_batches_coaching_id_batch_id_idx" ON "teacher_batches"("coaching_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_batches_teacher_id_batch_id_key" ON "teacher_batches"("teacher_id", "batch_id");

-- CreateIndex
CREATE INDEX "attendance_sessions_coaching_id_batch_id_session_date_idx" ON "attendance_sessions"("coaching_id", "batch_id", "session_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_coaching_id_batch_id_session_date_key" ON "attendance_sessions"("coaching_id", "batch_id", "session_date");

-- CreateIndex
CREATE INDEX "attendance_records_coaching_id_student_id_status_idx" ON "attendance_records"("coaching_id", "student_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_student_id_key" ON "attendance_records"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "tests_coaching_id_batch_id_test_date_idx" ON "tests"("coaching_id", "batch_id", "test_date");

-- CreateIndex
CREATE INDEX "test_results_coaching_id_student_id_idx" ON "test_results"("coaching_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_results_test_id_student_id_key" ON "test_results"("test_id", "student_id");

-- CreateIndex
CREATE INDEX "homework_coaching_id_batch_id_due_date_idx" ON "homework"("coaching_id", "batch_id", "due_date");

-- CreateIndex
CREATE INDEX "fee_plans_coaching_id_student_id_idx" ON "fee_plans"("coaching_id", "student_id");

-- CreateIndex
CREATE INDEX "fee_installments_coaching_id_status_due_date_idx" ON "fee_installments"("coaching_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "fee_transactions_receipt_number_key" ON "fee_transactions"("receipt_number");

-- CreateIndex
CREATE INDEX "fee_transactions_coaching_id_paid_at_idx" ON "fee_transactions"("coaching_id", "paid_at");

-- CreateIndex
CREATE INDEX "salaries_coaching_id_teacher_id_year_month_idx" ON "salaries"("coaching_id", "teacher_id", "year", "month");

-- CreateIndex
CREATE INDEX "expenses_coaching_id_category_expense_date_idx" ON "expenses"("coaching_id", "category", "expense_date");

-- CreateIndex
CREATE UNIQUE INDEX "notification_history_idempotency_key_key" ON "notification_history"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_history_coaching_id_channel_status_idx" ON "notification_history"("coaching_id", "channel", "status");

-- CreateIndex
CREATE INDEX "notification_history_coaching_id_created_at_idx" ON "notification_history"("coaching_id", "created_at");

-- CreateIndex
CREATE INDEX "student_timeline_coaching_id_student_id_occurred_at_idx" ON "student_timeline"("coaching_id", "student_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "risk_scores_student_id_key" ON "risk_scores"("student_id");

-- CreateIndex
CREATE INDEX "risk_scores_coaching_id_level_idx" ON "risk_scores"("coaching_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "subscriptions_coaching_id_is_active_status_idx" ON "subscriptions"("coaching_id", "is_active", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_credit_wallets_coaching_id_key" ON "ai_credit_wallets"("coaching_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_wallet_id_feature_created_at_idx" ON "ai_usage_logs"("wallet_id", "feature", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_coaching_id_key" ON "settings"("coaching_id");

-- CreateIndex
CREATE INDEX "notices_coaching_id_created_at_idx" ON "notices"("coaching_id", "created_at");

-- CreateIndex
CREATE INDEX "notices_coaching_id_batch_id_idx" ON "notices"("coaching_id", "batch_id");

-- CreateIndex
CREATE INDEX "coaching_knowledge_bases_coaching_id_type_is_active_idx" ON "coaching_knowledge_bases"("coaching_id", "type", "is_active");

-- CreateIndex
CREATE INDEX "coaching_knowledge_chunks_coaching_id_is_active_idx" ON "coaching_knowledge_chunks"("coaching_id", "is_active");

-- CreateIndex
CREATE INDEX "coaching_knowledge_chunks_knowledge_base_id_chunk_index_idx" ON "coaching_knowledge_chunks"("knowledge_base_id", "chunk_index");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "student_parents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_students" ADD CONSTRAINT "batch_students_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_students" ADD CONSTRAINT "batch_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_batches" ADD CONSTRAINT "teacher_batches_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_batches" ADD CONSTRAINT "teacher_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_installments" ADD CONSTRAINT "fee_installments_fee_plan_id_fkey" FOREIGN KEY ("fee_plan_id") REFERENCES "fee_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "fee_installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_timeline" ADD CONSTRAINT "student_timeline_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_credit_wallets" ADD CONSTRAINT "ai_credit_wallets_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "ai_credit_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_knowledge_bases" ADD CONSTRAINT "coaching_knowledge_bases_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_knowledge_chunks" ADD CONSTRAINT "coaching_knowledge_chunks_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "coaching_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

