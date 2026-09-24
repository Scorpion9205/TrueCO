-- Records which embedding model produced each chunk vector. Existing chunks get NULL and are
-- skipped by search until their knowledge base is re-synced (vectors of unknown origin cannot be
-- safely compared with new ones).
-- AlterTable
ALTER TABLE "coaching_knowledge_chunks" ADD COLUMN     "embedding_model" VARCHAR(100);

-- CreateIndex
CREATE INDEX "coaching_knowledge_chunks_coaching_id_embedding_model_idx" ON "coaching_knowledge_chunks"("coaching_id", "embedding_model");

