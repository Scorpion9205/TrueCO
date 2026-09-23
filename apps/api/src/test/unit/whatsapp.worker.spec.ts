import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhatsAppWorker } from '../../workers/whatsapp.worker.js';
import { IWhatsAppAdapter } from '../../modules/notifications/adapters/whatsapp.adapter.interface.js';
import { PrismaNotificationRepository } from '../../modules/notifications/notification.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { NotificationChannel, NotificationStatus } from '@trueco/types';
import { NOTIFICATION_EVENTS } from '../../modules/notifications/notification.events.js';

describe('WhatsAppWorker (Phase 3 BullMQ Worker Unit Tests)', () => {
  let worker: WhatsAppWorker;
  let mockAdapter: IWhatsAppAdapter;
  let mockRepo: any;
  let mockEventBus: IEventBus;

  beforeEach(() => {
    mockAdapter = {
      sendMessage: vi.fn().mockResolvedValue({
        providerMessageId: 'wamid.12345',
        status: 'SENT',
      }),
    };

    mockRepo = {
      claimForSending: vi.fn().mockResolvedValue(true),
      updateStatus: vi.fn().mockResolvedValue({}),
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    worker = new WhatsAppWorker(
      mockAdapter,
      mockRepo as unknown as PrismaNotificationRepository,
      mockEventBus,
    );
  });

  it('should dispatch message via adapter, update status to SENT, and publish NotificationSent event', async () => {
    const jobData: any = {
      notificationId: 'notif-1',
      coachingId: 'coaching-1',
      channel: NotificationChannel.WHATSAPP,
      recipient: '+919876543210',
      recipientType: 'PARENT',
      content: 'Hello parent',
      idempotencyKey: 'idemp-1',
    };

    await worker.processJob({ data: jobData } as any);

    // 1. Claimed the notification atomically before sending
    expect(mockRepo.claimForSending).toHaveBeenCalledWith('idemp-1');

    // 2. Sent via adapter
    expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+919876543210',
        bodyText: 'Hello parent',
      }),
    );

    // 3. Updated status in repository
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'idemp-1',
      NotificationStatus.SENT,
      expect.objectContaining({
        providerMessageId: 'wamid.12345',
      }),
    );

    // 4. Emitted NotificationSent event
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: NOTIFICATION_EVENTS.NOTIFICATION_SENT,
        payload: expect.objectContaining({
          notificationId: 'notif-1',
          recipient: '+919876543210',
        }),
      }),
    );
  });

  it('should skip sending when another job already claimed or sent the notification', async () => {
    mockRepo.claimForSending.mockResolvedValue(false);

    const jobData: any = {
      notificationId: 'notif-1',
      coachingId: 'coaching-1',
      channel: NotificationChannel.WHATSAPP,
      recipient: '+919876543210',
      idempotencyKey: 'already-sent-key',
    };

    await worker.processJob({ data: jobData } as any);

    // Adapter should NEVER be called on replay/duplicate
    expect(mockAdapter.sendMessage).not.toHaveBeenCalled();
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should mark status as FAILED and emit NotificationFailed when adapter fails', async () => {
    mockAdapter.sendMessage = vi.fn().mockResolvedValue({
      providerMessageId: '',
      status: 'FAILED',
      errorMessage: 'Invalid phone number format',
    });

    const jobData: any = {
      notificationId: 'notif-err',
      coachingId: 'coaching-1',
      channel: NotificationChannel.WHATSAPP,
      recipient: 'invalid-phone',
      idempotencyKey: 'fail-key',
    };

    await expect(worker.processJob({ data: jobData } as any)).rejects.toThrow('WhatsApp send failed');

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'fail-key',
      NotificationStatus.FAILED,
      expect.objectContaining({
        errorMessage: 'Invalid phone number format',
      }),
    );

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: NOTIFICATION_EVENTS.NOTIFICATION_FAILED,
        payload: expect.objectContaining({
          errorMessage: 'Invalid phone number format',
        }),
      }),
    );
  });
});
