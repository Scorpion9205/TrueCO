import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryWhatsAppAssistantRepository } from '../fakes/in-memory-whatsapp-assistant.repository.js';
import { WhatsAppAssistantService } from '../../modules/whatsapp-assistant/whatsapp-assistant.service.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { ASSISTANT_EVENTS } from '../../modules/whatsapp-assistant/whatsapp-assistant.events.js';

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
    assistantRepo.claimedMessages.add('msg-already-processed');

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
  it('releases the message claim when processing fails, so a retry can handle it', async () => {
    assistantRepo.parents.set('parent-1', {
      id: 'parent-1',
      coachingId: testCoachingId,
      phone: parentPhone,
      studentParents: [{ student: { id: student1Id, firstName: 'Riya', lastName: 'Verma' } }],
    });
    vi.spyOn(assistantRepo, 'getStudentAcademicSnapshot').mockRejectedValueOnce(new Error('database down'));

    const message = { messageId: 'msg-retry', from: parentPhone, body: 'fees' };
    await expect(assistantService.processInboundMessage(message)).rejects.toThrow('database down');
    expect(assistantRepo.claimedMessages.has('msg-retry')).toBe(false);

    const retried = await assistantService.processInboundMessage(message);
    expect(retried?.text).toContain('4500');
  });

  it('asks a parent registered at two institutes which one they mean, then remembers it', async () => {
    const otherCoaching = '99999999-9999-4999-8999-999999999999';
    assistantRepo.parents.set('parent-a', {
      id: 'parent-a',
      coachingId: testCoachingId,
      phone: '98765 43210',
      coaching: { name: 'Alpha Classes' },
      studentParents: [{ student: { id: student1Id, firstName: 'Riya', lastName: 'Verma' } }],
    });
    assistantRepo.parents.set('parent-b', {
      id: 'parent-b',
      coachingId: otherCoaching,
      phone: '+91-9876543210',
      coaching: { name: 'Beta Academy' },
      studentParents: [],
    });

    const prompt = await assistantService.processInboundMessage({ messageId: 'm1', from: parentPhone, body: 'fees' });
    expect(prompt?.text).toContain('1. Alpha Classes');
    expect(prompt?.text).toContain('2. Beta Academy');

    const confirm = await assistantService.processInboundMessage({ messageId: 'm2', from: parentPhone, body: '1' });
    expect(confirm?.text).toContain('Alpha Classes');
    expect(await assistantRepo.getCoachingChoice(parentPhone)).toBe(testCoachingId);

    // Later messages go straight to the chosen institute
    const fees = await assistantService.processInboundMessage({ messageId: 'm3', from: parentPhone, body: 'fees' });
    expect(fees?.text).toContain('4500');
  });

  it('matches phone numbers exactly, not as substrings', async () => {
    assistantRepo.parents.set('parent-x', {
      id: 'parent-x',
      coachingId: testCoachingId,
      phone: '1119876543210999',
      studentParents: [],
    });
    const reply = await assistantService.processInboundMessage({ messageId: 'm4', from: parentPhone, body: 'fees' });
    expect(reply?.intent).toBe('UNKNOWN');
  });
});
