-- Template variables are kept with each notification so a retry sends the same message
-- AlterTable
ALTER TABLE "notification_history" ADD COLUMN     "template_variables" JSONB;

-- Phones that replied STOP; not tenant data (one Vargly number serves every institute)
-- CreateTable
CREATE TABLE "whatsapp_opt_outs" (
    "phone" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_opt_outs_pkey" PRIMARY KEY ("phone")
);
