-- Phase 3: money and data integrity.
-- The new unique rules (receipt number and gateway payment id per coaching, one salary per
-- teacher and month) fail if an existing database already holds duplicates; resolve those first.

-- CreateEnum
CREATE TYPE "billing_payment_type" AS ENUM ('PLAN_UPGRADE', 'AI_CREDITS');

-- CreateEnum
CREATE TYPE "billing_payment_status" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- DropIndex
DROP INDEX "fee_transactions_receipt_number_key";

-- AlterTable
ALTER TABLE "fee_installments" ADD COLUMN     "remarks" TEXT;

-- CreateTable
CREATE TABLE "document_sequences" (
    "scope" VARCHAR(64) NOT NULL,
    "series" VARCHAR(64) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("scope","series")
);

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" UUID NOT NULL,
    "coaching_id" UUID NOT NULL,
    "type" "billing_payment_type" NOT NULL,
    "status" "billing_payment_status" NOT NULL DEFAULT 'CREATED',
    "plan_code" "plan_code",
    "billing_cycle" VARCHAR(20),
    "credits" INTEGER,
    "amount_paise" INTEGER NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "gateway_order_id" VARCHAR(100) NOT NULL,
    "gateway_payment_id" VARCHAR(100),
    "invoice_number" VARCHAR(50),
    "paid_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_payments_gateway_order_id_key" ON "billing_payments"("gateway_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payments_gateway_payment_id_key" ON "billing_payments"("gateway_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payments_invoice_number_key" ON "billing_payments"("invoice_number");

-- CreateIndex
CREATE INDEX "billing_payments_coaching_id_created_at_idx" ON "billing_payments"("coaching_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "fee_transactions_coaching_id_receipt_number_key" ON "fee_transactions"("coaching_id", "receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "fee_transactions_coaching_id_transaction_ref_key" ON "fee_transactions"("coaching_id", "transaction_ref");

-- CreateIndex
CREATE UNIQUE INDEX "salaries_teacher_id_year_month_key" ON "salaries"("teacher_id", "year", "month");

-- AddForeignKey
ALTER TABLE "fee_plans" ADD CONSTRAINT "fee_plans_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_coaching_id_fkey" FOREIGN KEY ("coaching_id") REFERENCES "coachings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- billing_payments holds tenant data: same row-level security as every other tenant table
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON billing_payments
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR coaching_id = NULLIF(current_setting('app.current_coaching_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR coaching_id = NULLIF(current_setting('app.current_coaching_id', true), '')::uuid
  );
