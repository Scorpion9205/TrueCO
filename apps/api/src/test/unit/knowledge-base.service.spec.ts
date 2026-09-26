import { describe, it, expect, beforeEach, vi } from 'vitest';
import { envConfig } from '../../config/env.config.js';
import { KnowledgeBaseService } from '../../modules/ai/rag/knowledge-base.service.js';
import { InMemoryKnowledgeBaseRepository } from '../fakes/in-memory-knowledge-base.repository.js';
import { MockEmbeddingProvider } from '../../modules/ai/embeddings/mock-embedding.provider.js';
import { EventBus } from '../../events/event-bus.js';
import { AI_EVENTS } from '../../modules/ai/ai.events.js';

describe('KnowledgeBaseService (RAG & Multi-Tenant pgvector)', () => {
  let service: KnowledgeBaseService;
  let repository: InMemoryKnowledgeBaseRepository;
  let embeddingProvider: MockEmbeddingProvider;
  let eventBus: EventBus;

  const COACHING_A = 'coaching-uuid-1111';
  const COACHING_B = 'coaching-uuid-2222';

  beforeEach(() => {
    repository = new InMemoryKnowledgeBaseRepository();
    embeddingProvider = new MockEmbeddingProvider();
    eventBus = new EventBus();

    service = new KnowledgeBaseService(repository, embeddingProvider, eventBus);
  });

  it('should successfully ingest a document, chunk it, and publish KnowledgeIngested event', async () => {
    let capturedEvent: any = null;
    eventBus.subscribe(AI_EVENTS.KNOWLEDGE_INGESTED, async (event) => {
      capturedEvent = event;
    });

    const policyDoc = {
      title: 'Fee Refund Policy 2026',
      type: 'POLICY' as const,
      rawContent:
        'Gravity Classes Refund Policy 2026:\n\n' +
        '1. If a student withdraws within 15 days of batch commencement, 80% fee is refunded.\n\n' +
        '2. Between 16 to 30 days, 50% tuition fee is refunded minus registration fee.\n\n' +
        '3. No refunds are granted after 30 days of class commencement under any circumstances.',
    };

    const result = await service.ingestDocument(policyDoc, COACHING_A);

    expect(result.document.id).toBeDefined();
    expect(result.document.title).toBe(policyDoc.title);
    expect(result.chunksCount).toBeGreaterThanOrEqual(1);

    // Verify EventBus publication
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.payload.coachingId).toBe(COACHING_A);
    expect(capturedEvent.payload.title).toBe(policyDoc.title);
    expect(capturedEvent.payload.totalChunks).toBe(result.chunksCount);
  });

  it('should perform vector similarity search and retrieve matching chunk', async () => {
    await service.ingestDocument(
      {
        title: 'Batch Schedule and Timing',
        type: 'SCHEDULE' as const,
        rawContent:
          'Class 10 Physics Batch Timings:\n\n' +
          'Monday, Wednesday, and Friday from 5:00 PM to 6:30 PM in Hall A.\n\n' +
          'Class 12 Chemistry Batch:\n\n' +
          'Tuesday, Thursday, and Saturday from 6:30 PM to 8:00 PM in Hall B.',
      },
      COACHING_A,
    );

    const matches = await service.searchKnowledge(
      'What are the timings for Class 10 Physics?',
      COACHING_A,
      2,
      0.3, // relaxed threshold for mock vectors
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].content).toContain('Class 10 Physics');
    expect(matches[0].similarity).toBeGreaterThan(0);
  });

  it('CRITICAL: Cross-Tenant Isolation Suite - Tenant B cannot retrieve Tenant A documents', async () => {
    // 1. Ingest sensitive policy under Coaching A
    await service.ingestDocument(
      {
        title: 'Coaching A Internal Staff Salaries and Rules',
        type: 'POLICY' as const,
        rawContent: 'Faculty salary bonus structure for Coaching A teachers is paid on the 5th of every month.',
      },
      COACHING_A,
    );

    // 2. Query as Coaching B for the exact same inquiry
    const leakedMatches = await service.searchKnowledge(
      'Faculty salary bonus structure',
      COACHING_B, // Different Tenant ID
      10,
      0.0, // Minimum possible threshold
    );

    // 3. Must return 0 results! Absolutely zero cross-tenant leakage!
    expect(leakedMatches).toHaveLength(0);
  });

  it('should soft-delete document and prevent subsequent search matches', async () => {
    const { document } = await service.ingestDocument(
      {
        title: 'Temporary Holiday Notice',
        type: 'GENERAL_NOTICE' as const,
        rawContent: 'Coaching institute will remain closed on Friday for Holi celebrations.',
      },
      COACHING_A,
    );

    // Verify it exists before deletion
    const beforeDelete = await service.searchKnowledge('Holi celebrations holiday', COACHING_A, 2, 0.3);
    expect(beforeDelete.length).toBeGreaterThan(0);

    // Delete
    const deleted = await service.deleteDocument(document.id, COACHING_A);
    expect(deleted).toBe(true);

    // Verify it no longer appears in search
    const afterDelete = await service.searchKnowledge('Holi celebrations holiday', COACHING_A, 2, 0.3);
    expect(afterDelete).toHaveLength(0);
  });

  describe('embedding models', () => {
    const doc = {
      title: 'Batch timings',
      type: 'SCHEDULE' as const,
      rawContent: 'Class 10 Physics meets on Monday, Wednesday and Friday from 5 PM to 6:30 PM.',
    };

    it('never stores or searches mock vectors in production; the document waits for a model', async () => {
      const real = envConfig.get.bind(envConfig);
      const get = vi
        .spyOn(envConfig, 'get')
        .mockImplementation(((key: string) => (key === 'NODE_ENV' ? 'production' : real(key as any))) as any);
      try {
        expect(service.canEmbed).toBe(false);
        const { chunksCount } = await service.ingestDocument(doc, COACHING_A);
        expect(chunksCount).toBe(0);
        expect(repository.activeChunks()).toEqual([]);
        expect(await service.searchKnowledge('When is physics class?', COACHING_A)).toEqual([]);
        await expect(service.reindexPending()).rejects.toThrow(/No embedding model/);
      } finally {
        get.mockRestore();
      }
    });

    it('re-indexes documents that have no chunks from the current model, and only those', async () => {
      await service.ingestDocument(doc, COACHING_A);
      const other = new MockEmbeddingProvider();
      Object.defineProperty(other, 'modelId', { value: 'openai:text-embedding-3-small' });
      const upgraded = new KnowledgeBaseService(repository, other, eventBus);

      expect(await upgraded.reindexPending()).toBe(1);
      expect(repository.activeChunks('openai:text-embedding-3-small').length).toBeGreaterThan(0);
      // Chunks of the old model are retired, not left to be searched
      expect(repository.activeChunks('mock:hash-v1')).toEqual([]);
      expect(await upgraded.reindexPending()).toBe(0);
    });

    it('lets RAG_MIN_SIMILARITY set how relevant an excerpt must be', async () => {
      await service.ingestDocument(doc, COACHING_A);
      process.env.RAG_MIN_SIMILARITY = '0.99';
      try {
        expect(await service.searchKnowledge('physics class timing', COACHING_A)).toEqual([]);
      } finally {
        delete process.env.RAG_MIN_SIMILARITY;
      }
      expect((await service.searchKnowledge('physics class timing', COACHING_A)).length).toBeGreaterThan(0);
    });
  });
});
