import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { createTenantPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { PrismaKnowledgeBaseRepository } from '../../modules/ai/rag/knowledge-base.repository.js';
import { MockEmbeddingProvider } from '../../modules/ai/embeddings/mock-embedding.provider.js';

/** pgvector search only compares vectors produced by the same embedding model. */
const APP_URL = process.env.TEST_DATABASE_URL;
const OWNER_URL = process.env.TEST_DATABASE_OWNER_URL;
const COACHING = 'abababab-0000-4000-8000-000000000001';

describe.skipIf(!APP_URL || !OWNER_URL)('Knowledge base search (real PostgreSQL + pgvector)', () => {
  let owner: PrismaClient;
  let appBase: PrismaClient;

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });
    appBase = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    await owner.$transaction([
      owner.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`,
      owner.$executeRawUnsafe(`DELETE FROM coachings WHERE id = '${COACHING}'`),
      owner.coaching.create({ data: { id: COACHING, name: 'Vector Co', code: 'vector-co', phone: '1', email: 'v@v.in' } }),
    ]);
  });

  afterAll(async () => {
    await owner?.$disconnect();
    await appBase?.$disconnect();
  });

  it('returns chunks of the current model and ignores vectors from another model', async () => {
    const repo = new PrismaKnowledgeBaseRepository(createTenantPrismaClient(appBase) as any);
    const embed = new MockEmbeddingProvider();
    const text = 'Monthly fees are due on the 5th.';
    const [vector] = await embed.generateEmbeddings([text]);

    await RequestContextService.runForTenant(COACHING, async () => {
      const doc = await repo.createDocument({ title: 'Fees', rawContent: text } as any, COACHING);
      const chunk = { coachingId: COACHING, knowledgeBaseId: doc.id, chunkIndex: 0, content: text, tokenCount: 8, vector };
      await repo.insertChunks([
        { ...chunk, embeddingModel: 'mock:hash-v1' },
        { ...chunk, chunkIndex: 1, embeddingModel: 'openai:text-embedding-3-small' },
      ]);

      const hits = await repo.searchSimilarChunks({ queryVector: vector, coachingId: COACHING, embeddingModel: 'mock:hash-v1', threshold: 0.5 });
      expect(hits.map((h) => h.chunkIndex)).toEqual([0]);

      const none = await repo.searchSimilarChunks({ queryVector: vector, coachingId: COACHING, embeddingModel: 'gemini:gemini-embedding-001', threshold: 0.5 });
      expect(none).toEqual([]);
    });
  });
});
