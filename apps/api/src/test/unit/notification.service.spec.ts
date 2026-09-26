import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DAILY_LIMIT_REASON,
  NotificationService,
  startOfIndiaDay,
} from '../../modules/notifications/notification.service.js';
import {
  INotificationRepository,
  CreateNotificationHistoryInput,
  UpdateNotificationStatusInput,
} from '../../modules/notifications/notification.repository.js';
import { QueueRegistry } from '../../queues/queue.registry.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { NotificationChannel, NotificationStatus } from '@vargly/types';
import { AppError } from '../../common/middleware/error-handler.middleware.js';

class InMemoryNotificationRepository implements INotificationRepository {
  public notifications: Map<string, any> = new Map();

  public async createHistory(input: CreateNotificationHistoryInput): Promise<any> {
    const existing = this.findByIdempotencyKeySync(input.idempotencyKey);
    if (existing) return existing;

    const record = {
      id: `notif-${Date.now()}-${Math.random()}`,
      coachingId: input.coachingId,
      channel: input.channel,
      recipient: input.recipient,
      recipientType: input.recipientType,
      templateName: input.templateName,
      templateVariables: input.templateVariables,
      content: input.content,
      idempotencyKey: input.idempotencyKey,
      status: input.failedReason ? NotificationStatus.FAILED : NotificationStatus.QUEUED,
      errorMessage: input.failedReason,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.notifications.set(record.id, record);
    return record;
  }

  public async updateStatus(
    idempotencyKey: string,
    status: NotificationStatus,
    data?: UpdateNotificationStatusInput,
  ): Promise<any> {
    const record = this.findByIdempotencyKeySync(idempotencyKey);
    if (!record) throw new Error('Notification not found');
    record.status = status;
    if (data?.providerMessageId) record.providerMessageId = data.providerMessageId;
    if (data?.errorMessage) record.errorMessage = data.errorMessage;
    if (data?.sentAt) record.sentAt = data.sentAt;
    if (data?.deliveredAt) record.deliveredAt = data.deliveredAt;
    if (data?.readAt) record.readAt = data.readAt;
    record.updatedAt = new Date();
    this.notifications.set(record.id, record);
    return record;
  }

  public async updateStatusByProviderId(
    providerMessageId: string,
    status: NotificationStatus,
    data?: UpdateNotificationStatusInput,
  ): Promise<any> {
    for (const record of this.notifications.values()) {
      if (record.providerMessageId === providerMessageId) {
        record.status = status;
        if (data?.errorMessage) record.errorMessage = data.errorMessage;
        if (data?.deliveredAt) record.deliveredAt = data.deliveredAt;
        if (data?.readAt) record.readAt = data.readAt;
        record.updatedAt = new Date();
        this.notifications.set(record.id, record);
        return record;
      }
    }
    return null;
  }

  public async findFailed(coachingId: string): Promise<any[]> {
    return Array.from(this.notifications.values()).filter(
      (n) => n.coachingId === coachingId && n.status === NotificationStatus.FAILED,
    );
  }

  public async findById(id: string): Promise<any | null> {
    return this.notifications.get(id) || null;
  }

  public async claimForSending(key: string): Promise<boolean> {
    const record = this.findByIdempotencyKeySync(key);
    if (!record || !['QUEUED', 'FAILED'].includes(record.status)) return false;
    record.status = 'SENDING';
    return true;
  }

  public async findByIdempotencyKey(key: string): Promise<any | null> {
    return this.findByIdempotencyKeySync(key);
  }

  public async countSince(coachingId: string, channel: NotificationChannel, since: Date): Promise<number> {
    return Array.from(this.notifications.values()).filter(
      (n) => n.coachingId === coachingId && n.channel === channel && n.createdAt >= since,
    ).length;
  }

  private findByIdempotencyKeySync(key: string): any | null {
    for (const record of this.notifications.values()) {
      if (record.idempotencyKey === key) return record;
    }
    return null;
  }
}

describe('NotificationService (Phase 3 Domain Unit Tests)', () => {
  let notificationService: NotificationService;
  let notificationRepo: InMemoryNotificationRepository;
  let mockQueueRegistry: any;
  let mockEventBus: IEventBus;
  let mockQueue: any;
  let optedOut: Set<string>;
  let dailyLimit: number;

  /** A resolver that answers raw numbers and emails as the real one does, without a database */
  const directResolver = {
    resolveRecipients: async (token: string) => [
      token.includes('@')
        ? { recipientId: token, email: token, name: 'Direct', recipientType: 'PARENT' }
        : { recipientId: token, phone: token, name: 'Direct', recipientType: 'PARENT' },
    ],
    instituteName: async () => 'Sharma Classes',
    studentName: async () => 'Aarav Singh',
  };
  const serviceWith = (resolver: any) =>
    new NotificationService(
      notificationRepo,
      mockQueueRegistry as unknown as QueueRegistry,
      mockEventBus,
      resolver,
      {
        findOptedOut: async (phones: string[]) =>
          new Set(phones.map((p) => p.slice(-10)).filter((p) => optedOut.has(p))),
      },
      () => dailyLimit,
    );

  beforeEach(() => {
    optedOut = new Set();
    dailyLimit = 200;
    notificationRepo = new InMemoryNotificationRepository();

    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    };

    mockQueueRegistry = {
      getQueue: vi.fn().mockReturnValue(mockQueue),
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    notificationService = serviceWith(directResolver);
  });

  it('should enqueue a WhatsApp notification and record it with status QUEUED', async () => {
    const result = await notificationService.enqueueNotification(
      {
        channel: NotificationChannel.WHATSAPP,
        recipient: '+919876543210',
        recipientType: 'PARENT',
        content: 'Your child was absent today',
        templateName: 'student_absent_alert',
        idempotencyKey: 'test.absent.101',
      },
      'coaching-1',
    );

    expect(result).toBeDefined();
    expect(result.status).toBe(NotificationStatus.QUEUED);
    expect(result.recipient).toBe('+919876543210');
    expect(result.idempotencyKey).toBe('test.absent.101');

    expect(mockQueueRegistry.getQueue).toHaveBeenCalledWith('whatsapp-queue');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send_notification',
      expect.objectContaining({
        recipient: '+919876543210',
        idempotencyKey: 'test.absent.101',
      }),
      expect.objectContaining({
        jobId: 'test.absent.101',
      }),
    );
  });

  it('should enqueue an Email notification to email-queue', async () => {
    const result = await notificationService.enqueueNotification(
      {
        channel: NotificationChannel.EMAIL,
        recipient: 'parent@example.com',
        recipientType: 'PARENT',
        subject: 'Monthly Fee Reminder',
        content: '<h1>Your fee installment is due</h1>',
        idempotencyKey: 'fee.reminder.202',
      },
      'coaching-1',
    );

    expect(result.channel).toBe(NotificationChannel.EMAIL);
    expect(mockQueueRegistry.getQueue).toHaveBeenCalledWith('email-queue');
  });

  it('should update status when delivery webhook is received', async () => {
    // 1. Enqueue
    const notif = await notificationService.enqueueNotification(
      {
        channel: NotificationChannel.WHATSAPP,
        recipient: '+919876543210',
        recipientType: 'PARENT',
        content: 'Test content',
        idempotencyKey: 'test.webhook.303',
      },
      'coaching-1',
    );

    // 2. Simulate worker setting providerMessageId
    await notificationRepo.updateStatus(notif.idempotencyKey, NotificationStatus.SENT, {
      providerMessageId: 'wamid.HBgLM',
    });

    // 3. Webhook received
    await notificationService.handleWebhookStatus('wamid.HBgLM', NotificationStatus.DELIVERED);

    const updated = await notificationRepo.findById(notif.id);
    expect(updated.status).toBe(NotificationStatus.DELIVERED);
    expect(updated.deliveredAt).toBeDefined();
  });

  it('should allow retrying a failed notification', async () => {
    const notif = await notificationService.enqueueNotification(
      {
        channel: NotificationChannel.WHATSAPP,
        recipient: '+919876543210',
        recipientType: 'PARENT',
        content: 'Failed message',
        idempotencyKey: 'test.fail.404',
      },
      'coaching-1',
    );

    await notificationRepo.updateStatus(notif.idempotencyKey, NotificationStatus.FAILED, {
      errorMessage: 'User phone unreachable',
    });

    const retried = await notificationService.retryNotification(notif.id, 'coaching-1');
    expect(retried.status).toBe(NotificationStatus.QUEUED);
    expect(mockQueue.add).toHaveBeenCalledTimes(2); // Initial + Retry
  });

  it('should throw NOT_FOUND when retrying non-existent notification', async () => {
    await expect(notificationService.retryNotification('missing-id', 'coaching-1')).rejects.toThrow(
      AppError,
    );
  });

  describe('group recipients', () => {
    const withResolver = (targets: any[]) =>
      serviceWith({ ...directResolver, resolveRecipients: vi.fn().mockResolvedValue(targets) });
    const send = (service: NotificationService) =>
      service.enqueueNotification(
        {
          channel: NotificationChannel.WHATSAPP,
          recipient: 'batch:b1:parents',
          recipientType: 'PARENT',
          content: 'Holiday tomorrow',
          idempotencyKey: 'notice.1.parent',
        },
        'coaching-1',
      );

    it('sends only to people with a number, never to the group token itself', async () => {
      await send(
        withResolver([
          { recipientId: 'p0', name: 'No phone', recipientType: 'PARENT' },
          { recipientId: 'p1', phone: '+919800000001', name: 'A', recipientType: 'PARENT' },
          { recipientId: 'p2', phone: '+919800000002', name: 'B', recipientType: 'PARENT' },
        ]),
      );
      const sentTo = mockQueue.add.mock.calls.map((call: any[]) => call[1].recipient);
      expect(sentTo).toEqual(['+919800000001', '+919800000002']);
    });

    it('fails clearly when nobody can be reached', async () => {
      await expect(send(withResolver([]))).rejects.toMatchObject({ code: 'NO_RECIPIENTS' });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('templates, STOP and the daily limit', () => {
    const parents = [
      { recipientId: 'p1', phone: '9800000001', name: 'A', recipientType: 'PARENT', studentName: 'Riya Verma' },
      { recipientId: 'p2', phone: '9800000002', name: 'B', recipientType: 'PARENT', studentName: 'Kabir and Meera Rao' },
      { recipientId: 'p3', phone: '9800000003', name: 'C', recipientType: 'PARENT', studentName: 'Dev Jain' },
    ];
    const absent = (overrides: Record<string, unknown> = {}) =>
      serviceWith({ ...directResolver, resolveRecipients: vi.fn().mockResolvedValue(parents) }).enqueueNotification(
        {
          channel: NotificationChannel.WHATSAPP,
          recipient: 'batch:b1:parents',
          recipientType: 'PARENT',
          content: 'absent',
          templateName: 'student_absent_alert',
          templateVariables: { date: '5 Oct 2026' },
          idempotencyKey: 'absent.s1',
          ...overrides,
        },
        'coaching-1',
      );
    const jobs = () => mockQueue.add.mock.calls.map((call: any[]) => call[1]);

    it("names the institute and each parent's own child", async () => {
      await absent();
      expect(jobs().map((job: any) => job.templateVariables)).toEqual([
        { institute: 'Sharma Classes', student: 'Riya Verma', date: '5 Oct 2026' },
        { institute: 'Sharma Classes', student: 'Kabir and Meera Rao', date: '5 Oct 2026' },
        { institute: 'Sharma Classes', student: 'Dev Jain', date: '5 Oct 2026' },
      ]);
      expect(jobs()[0].content).toBe(
        'Attendance update from Sharma Classes: Riya Verma was marked absent on 5 Oct 2026. If this is not correct, please contact the institute.',
      );
    });

    it('names the student a message is about, even when it goes to someone else', async () => {
      await absent({ studentId: 's9' });
      expect(jobs()[0].templateVariables.student).toBe('Aarav Singh');
    });

    it('skips people who replied STOP, and says so when that is everyone', async () => {
      optedOut = new Set(['9800000002']);
      await absent();
      expect(jobs().map((job: any) => job.recipient)).toEqual(['9800000001', '9800000003']);

      optedOut = new Set(['9800000001', '9800000002', '9800000003']);
      await expect(absent({ idempotencyKey: 'absent.s2' })).rejects.toMatchObject({
        code: 'RECIPIENT_OPTED_OUT',
      });
    });

    it('still answers someone who wrote in after opting out', async () => {
      optedOut = new Set(['9800000001', '9800000002', '9800000003']);
      await absent({ isReply: true, templateName: undefined });
      expect(jobs()).toHaveLength(3);
    });

    it("holds back what is over the institute's daily limit as failed, to retry later", async () => {
      dailyLimit = 2;
      await absent();
      expect(jobs().map((job: any) => job.recipient)).toEqual(['9800000001', '9800000002']);
      const held = [...notificationRepo.notifications.values()].find((n) => n.recipient === '9800000003');
      expect(held).toMatchObject({ status: NotificationStatus.FAILED, errorMessage: DAILY_LIMIT_REASON });

      // Nothing is left for another send today
      await absent({ idempotencyKey: 'absent.s3' });
      expect(jobs()).toHaveLength(2);
    });

    it('never holds back alerts to the owner', async () => {
      dailyLimit = 1;
      await absent();
      await absent({ recipient: 'coaching:coaching-1:owner', idempotencyKey: 'risk.s1' });
      expect(jobs()).toHaveLength(1 + 3);
    });

    it('keeps the template variables so a retry sends the same message', async () => {
      const notif = await absent();
      await notificationRepo.updateStatus(notif.idempotencyKey, NotificationStatus.FAILED);
      await notificationService.retryNotification(notif.id, 'coaching-1');
      expect(jobs().at(-1).templateVariables).toMatchObject({ student: 'Riya Verma' });
    });
  });

  it('starts the WhatsApp day at midnight in India', () => {
    // 20:00 UTC on 4 Oct is 01:30 on 5 Oct in India
    expect(startOfIndiaDay(new Date('2026-10-04T20:00:00Z')).toISOString()).toBe('2026-10-04T18:30:00.000Z');
    expect(startOfIndiaDay(new Date('2026-10-04T18:00:00Z')).toISOString()).toBe('2026-10-03T18:30:00.000Z');
  });
});
