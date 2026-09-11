import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhatsAppAssistantService } from '../../modules/whatsapp-assistant/whatsapp-assistant.service.js';
import {
  IWhatsAppAssistantRepository,
  StudentAcademicSnapshot,
} from '../../modules/whatsapp-assistant/whatsapp-assistant.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { ConversationContext } from '../../modules/whatsapp-assistant/dto/whatsapp-assistant.dto.js';
import { ASSISTANT_EVENTS } from '../../modules/whatsapp-assistant/whatsapp-assistant.events.js';

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

describe('WhatsAppAssistantService (Phase 6 Assistant Unit Tests)', () => {
  let assistantService: WhatsAppAssistantService;
  let assistantRepo: InMemoryWhatsAppAssistantRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const parentPhone = '+919876543210';
  const student1Id = 's1-1111';
  const student2Id = 's2-2222';

  beforeEach(() => {
    assistantRepo = new InMemoryWhatsAppAssistantRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    assistantService = new WhatsAppAssistantService(assistantRepo, mockEventBus);

    // Setup snapshot for student 1
    assistantRepo.snapshots.set(student1Id, {
      student: { id: student1Id, firstName: 'Riya', lastName: 'Verma' },
      batch: { id: 'b1', name: 'Batch 10th ICSE' },
      feeSummary: {
        totalPending: 4500,
        upcomingDueDate: new Date('2026-04-15'),
      },
      attendanceSummary: {
        totalClasses: 40,
        attendedClasses: 36,
        percentage: 90.0,
      },
      recentTestResult: {
        testTitle: 'Mathematics Periodic Test 2',
        marksObtained: 45,
        totalMarks: 50,
        percentage: 90.0,
      },
      pendingHomework: [
        { id: 'hw-1', title: 'Quadratic Equations Exercise 4.2', dueDate: new Date('2026-04-10') },
      ],
    });
  });

  it('rejects duplicate messageId under idempotency check', async () => {
    assistantRepo.processedMessages.add('msg-already-processed');

    const result = await assistantService.processInboundMessage({
      messageId: 'msg-already-processed',
      from: parentPhone,
      body: 'fees balance',
    });

    expect(result).toBeNull();
  });

  it('handles unregistered phone numbers gracefully', async () => {
    const result = await assistantService.processInboundMessage({
      messageId: 'msg-unregistered',
      from: '+919999999999',
      body: 'hello',
    });

    expect(result).not.toBeNull();
    expect(result?.text).toContain('not registered');
  });

  it('prompts parent when multiple children are registered (disambiguation flow)', async () => {
    assistantRepo.parents.set('parent-1', {
      id: 'parent-1',
      coachingId: testCoachingId,
      phone: parentPhone,
      studentParents: [
        { student: { id: student1Id, firstName: 'Riya', lastName: 'Verma' } },
        { student: { id: student2Id, firstName: 'Arjun', lastName: 'Verma' } },
      ],
    });

    // Parent sends initial inquiry
    const promptReply = await assistantService.processInboundMessage({
      messageId: 'msg-init-multi',
      from: parentPhone,
      body: 'Check fee balance',
    });

    expect(promptReply?.text).toContain('multiple students registered');
    expect(promptReply?.text).toContain('1. Riya Verma');
    expect(promptReply?.text).toContain('2. Arjun Verma');

    // Parent replies with "1" to select Riya
    const selectReply = await assistantService.processInboundMessage({
      messageId: 'msg-select-1',
      from: parentPhone,
      body: '1',
    });

    expect(selectReply?.text).toContain('Selected student: Riya Verma');
  });

  it('answers FEES inquiry accurately with pending amount and due date', async () => {
    assistantRepo.parents.set('parent-1', {
      id: 'parent-1',
      coachingId: testCoachingId,
      phone: parentPhone,
      studentParents: [{ student: { id: student1Id, firstName: 'Riya', lastName: 'Verma' } }],
    });

    const reply = await assistantService.processInboundMessage({
      messageId: 'msg-fee-inquiry',
      from: parentPhone,
      body: 'Please tell me the fee balance',
    });

    expect(reply?.intent).toBe('FEES');
    expect(reply?.text).toContain('Pending Balance: ₹4500');
    expect(reply?.text).toContain('Riya Verma');

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ASSISTANT_EVENTS.ASSISTANT_REPLIED,
        payload: expect.objectContaining({
          to: parentPhone,
          intent: 'FEES',
        }),
      }),
    );
  });

  it('answers ATTENDANCE inquiry with attended classes and percentage', async () => {
    assistantRepo.parents.set('parent-1', {
      id: 'parent-1',
      coachingId: testCoachingId,
      phone: parentPhone,
      studentParents: [{ student: { id: student1Id, firstName: 'Riya', lastName: 'Verma' } }],
    });

    const reply = await assistantService.processInboundMessage({
      messageId: 'msg-attendance-inquiry',
      from: parentPhone,
      body: 'attendance summary',
    });

    expect(reply?.intent).toBe('ATTENDANCE');
    expect(reply?.text).toContain('Overall: 90%');
    expect(reply?.text).toContain('36 of 40');
  });

  it('answers RESULTS inquiry with test score and percentage', async () => {
    assistantRepo.parents.set('parent-1', {
      id: 'parent-1',
      coachingId: testCoachingId,
      phone: parentPhone,
      studentParents: [{ student: { id: student1Id, firstName: 'Riya', lastName: 'Verma' } }],
    });

    const reply = await assistantService.processInboundMessage({
      messageId: 'msg-results-inquiry',
      from: parentPhone,
      body: 'what are the recent test marks?',
    });

    expect(reply?.intent).toBe('RESULTS');
    expect(reply?.text).toContain('Mathematics Periodic Test 2');
    expect(reply?.text).toContain('45/50 (90%)');
  });

  it('answers HOMEWORK inquiry with pending assignments', async () => {
    assistantRepo.parents.set('parent-1', {
      id: 'parent-1',
      coachingId: testCoachingId,
      phone: parentPhone,
      studentParents: [{ student: { id: student1Id, firstName: 'Riya', lastName: 'Verma' } }],
    });

    const reply = await assistantService.processInboundMessage({
      messageId: 'msg-hw-inquiry',
      from: parentPhone,
      body: 'homework assignments',
    });

    expect(reply?.intent).toBe('HOMEWORK');
    expect(reply?.text).toContain('Quadratic Equations Exercise 4.2');
  });
});
