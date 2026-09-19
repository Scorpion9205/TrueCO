import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhatsAppAssistantService } from '../../modules/whatsapp-assistant/whatsapp-assistant.service.js';
import {
  IWhatsAppAssistantRepository,
  StudentAcademicSnapshot,
} from '../../modules/whatsapp-assistant/whatsapp-assistant.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { ConversationContext } from '../../modules/whatsapp-assistant/dto/whatsapp-assistant.dto.js';
import { KnowledgeBaseService } from '../../modules/ai/rag/knowledge-base.service.js';
import { InMemoryKnowledgeBaseRepository } from '../fakes/in-memory-knowledge-base.repository.js';
import { MockEmbeddingProvider } from '../../modules/ai/embeddings/mock-embedding.provider.js';
import { EventBus } from '../../events/event-bus.js';

class InMemoryWhatsAppAssistantRepository implements IWhatsAppAssistantRepository {
  public parents: Map<string, any> = new Map();
  public snapshots: Map<string, StudentAcademicSnapshot> = new Map();
  public notices: any[] = [];
  public processedMessages = new Set<string>();
  public contexts = new Map<string, ConversationContext>();

  public async resolveParentByPhone(phone: string): Promise<any | null> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    for (const p of this.parents.values()) {
      if (p.phone.replace(/\D/g, '').includes(cleanPhone)) {
        return p;
      }
    }
    return null;
  }

  public async getStudentAcademicSnapshot(studentId: string): Promise<StudentAcademicSnapshot | null> {
    return this.snapshots.get(studentId) || null;
  }

  public async getRecentNotices(_coachingId: string, _batchId?: string): Promise<any[]> {
    return this.notices;
  }

  public async saveConversationContext(phone: string, context: ConversationContext): Promise<void> {
    this.contexts.set(phone, context);
  }

  public async getConversationContext(phone: string): Promise<ConversationContext | null> {
    return this.contexts.get(phone) || null;
  }

  public async isMessageProcessed(messageId: string): Promise<boolean> {
    return this.processedMessages.has(messageId);
  }

  public async markMessageProcessed(messageId: string): Promise<void> {
    this.processedMessages.add(messageId);
  }
}

describe('WhatsAppAssistantService (RAG Knowledge & Hybrid Assistant)', () => {
  let assistantService: WhatsAppAssistantService;
  let assistantRepo: InMemoryWhatsAppAssistantRepository;
  let knowledgeService: KnowledgeBaseService;
  let mockAiService: any;
  let eventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const parentPhone = '+919876543210';
  const studentId = 's1-1111';

  beforeEach(async () => {
    assistantRepo = new InMemoryWhatsAppAssistantRepository();
    eventBus = new EventBus();

    const kbRepo = new InMemoryKnowledgeBaseRepository();
    const embeddingProvider = new MockEmbeddingProvider();
    knowledgeService = new KnowledgeBaseService(kbRepo, embeddingProvider, eventBus);

    // Ingest sample coaching policies and timings into RAG
    await knowledgeService.ingestDocument(
      {
        title: 'Refund Policy',
        type: 'POLICY',
        rawContent:
          'Gravity Classes Refund Rules:\n' +
          '1. Within 15 days of batch start: 80% tuition fee is refunded upon written application.\n' +
          '2. After 15 days: No refunds are permitted.',
      },
      testCoachingId,
    );

    await knowledgeService.ingestDocument(
      {
        title: 'Class 10 Batch Timing',
        type: 'SCHEDULE',
        rawContent:
          'Class 10 Physics Batch Timings:\n' +
          'Classes are conducted on Monday, Wednesday, and Friday from 5:00 PM to 6:30 PM.',
      },
      testCoachingId,
    );

    mockAiService = {
      generateCompletion: vi.fn().mockResolvedValue({
        content:
          'Namaste! As per our policy, 80% of tuition fee is refunded if you apply within 15 days of batch start. No refunds are permitted after 15 days.',
        model: 'gpt-4o-mini',
        promptTokens: 120,
        completionTokens: 35,
        totalTokens: 155,
      }),
    };

    assistantService = new WhatsAppAssistantService(
      assistantRepo,
      eventBus,
      knowledgeService,
      mockAiService,
    );

    // Register parent & student
    assistantRepo.parents.set('parent-1', {
      id: 'parent-1',
      coachingId: testCoachingId,
      phone: parentPhone,
      studentParents: [{ student: { id: studentId, firstName: 'Riya', lastName: 'Verma' } }],
    });

    assistantRepo.snapshots.set(studentId, {
      student: { id: studentId, firstName: 'Riya', lastName: 'Verma' },
      batch: { id: 'b1', name: 'Batch 10th ICSE' },
      feeSummary: { totalPending: 0 },
      attendanceSummary: { totalClasses: 20, attendedClasses: 19, percentage: 95.0 },
      recentTestResult: undefined,
      pendingHomework: [],
    });
  });

  it('should route general policy questions to RAG and synthesize contextual WhatsApp answer', async () => {
    const reply = await assistantService.processInboundMessage({
      messageId: 'msg-rag-1',
      from: parentPhone,
      body: 'What is your refund policy if we leave the coaching?',
    });

    expect(reply).not.toBeNull();
    expect(reply?.intent).toBe('RAG_KNOWLEDGE');
    expect(reply?.text).toContain('80% of tuition fee is refunded');

    // Verify AI service was called with system prompt containing retrieved context
    expect(mockAiService.generateCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'What is your refund policy if we leave the coaching?',
        feature: 'whatsapp.rag_assistant',
        systemPrompt: expect.stringContaining('Gravity Classes Refund Rules'),
      }),
      testCoachingId,
    );
  });

  it('should fall back gracefully when question has no matching knowledge in database', async () => {
    const reply = await assistantService.processInboundMessage({
      messageId: 'msg-rag-unknown',
      from: parentPhone,
      body: 'Do you provide swimming lessons at the center?',
    });

    expect(reply).not.toBeNull();
    expect(reply?.intent).toBe('RAG_KNOWLEDGE');
    expect(reply?.text).toContain('Kripya hamare coaching office se sampark karein');
  });

  it('should still handle deterministic FEES questions without calling AI service (0 AI Cost)', async () => {
    const reply = await assistantService.processInboundMessage({
      messageId: 'msg-det-fees',
      from: parentPhone,
      body: 'fee balance',
    });

    expect(reply).not.toBeNull();
    expect(reply?.intent).toBe('FEES');
    expect(reply?.text).toContain('All fees for Riya Verma are fully paid');

    // AI service should NEVER be invoked for deterministic fees/attendance queries!
    expect(mockAiService.generateCompletion).not.toHaveBeenCalled();
  });
});
