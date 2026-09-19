import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeBaseService } from '../../modules/ai/rag/knowledge-base.service.js';
import { InMemoryKnowledgeBaseRepository } from '../fakes/in-memory-knowledge-base.repository.js';
import { MockEmbeddingProvider } from '../../modules/ai/embeddings/mock-embedding.provider.js';
import { EventBus } from '../../events/event-bus.js';
import { KnowledgeSyncSubscriber } from '../../modules/ai/rag/knowledge-sync.subscriber.js';
import { createNoticeCreatedEvent } from '../../modules/notice-board/notice.events.js';
import { createHomeworkCreatedEvent } from '../../modules/homework/homework.events.js';
import { createTestCreatedEvent } from '../../modules/tests/test.events.js';

describe('KnowledgeSyncSubscriber (Event-Driven Auto-Sync to RAG)', () => {
  let knowledgeService: KnowledgeBaseService;
  let repository: InMemoryKnowledgeBaseRepository;
  let embeddingProvider: MockEmbeddingProvider;
  let eventBus: EventBus;
  let subscriber: KnowledgeSyncSubscriber;

  const COACHING_ID = 'coaching-uuid-101';

  beforeEach(() => {
    repository = new InMemoryKnowledgeBaseRepository();
    embeddingProvider = new MockEmbeddingProvider();
    eventBus = new EventBus();

    knowledgeService = new KnowledgeBaseService(repository, embeddingProvider, eventBus);
    subscriber = new KnowledgeSyncSubscriber(knowledgeService, eventBus);
    subscriber.register();
  });

  it('should auto-sync a newly published Notice into the Knowledge Base', async () => {
    const noticeEvent = createNoticeCreatedEvent(
      {
        noticeId: 'notice-uuid-1',
        coachingId: COACHING_ID,
        title: 'Independence Day Holiday Schedule',
        targetAudience: 'ALL',
      },
      'corr-123',
    );

    // Publish event
    await eventBus.publish(noticeEvent);

    // Verify document was auto-indexed in Knowledge Base
    const docs = await knowledgeService.listDocuments(COACHING_ID);
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe('[Notice] Independence Day Holiday Schedule');
    expect(docs[0].type).toBe('GENERAL_NOTICE');

    // Verify searchable via RAG
    const searchResults = await knowledgeService.searchKnowledge('Holiday schedule Independence Day', COACHING_ID);
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].content).toContain('Independence Day');
  });

  it('should auto-sync Homework assignment into the Knowledge Base', async () => {
    const hwEvent = createHomeworkCreatedEvent(
      {
        homeworkId: 'hw-uuid-1',
        coachingId: COACHING_ID,
        batchId: 'batch-10-math',
        title: 'Trigonometry Exercise 8.3 Q1 to Q10',
        dueDate: new Date('2026-10-15'),
      },
      'corr-456',
    );

    await eventBus.publish(hwEvent);

    const docs = await knowledgeService.listDocuments(COACHING_ID);
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe('[Homework] Trigonometry Exercise 8.3 Q1 to Q10');

    const searchResults = await knowledgeService.searchKnowledge('Trigonometry Exercise homework', COACHING_ID);
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].content).toContain('Trigonometry Exercise');
  });

  it('should auto-sync Test schedule into the Knowledge Base', async () => {
    const testEvent = createTestCreatedEvent(
      {
        testId: 'test-uuid-1',
        coachingId: COACHING_ID,
        batchId: 'batch-jee-physics',
        title: 'JEE Main Physics Mock Test 4',
        subject: 'Physics',
        testDate: new Date('2026-11-01'),
        totalMarks: 100,
      },
      'corr-789',
    );

    await eventBus.publish(testEvent);

    const docs = await knowledgeService.listDocuments(COACHING_ID);
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toContain('Physics Mock Test 4');

    const searchResults = await knowledgeService.searchKnowledge('Physics Mock Test schedule', COACHING_ID);
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].content).toContain('JEE Main Physics Mock Test 4');
  });
});
