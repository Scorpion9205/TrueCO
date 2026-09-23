-- CreateEnum
CREATE TYPE "auth_token_purpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "auth_action_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "auth_token_purpose" NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_action_tokens_token_hash_key" ON "auth_action_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_action_tokens_user_id_purpose_idx" ON "auth_action_tokens"("user_id", "purpose");

-- AddForeignKey
ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "auth_action_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

