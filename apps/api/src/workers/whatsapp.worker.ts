                                                                                                                                                                                                                                                                                                              import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { IWhatsAppAdapter } from '../modules/notifications/adapters/whatsapp.adapter.interface.js';
import { MetaCloudWhatsAppAdapter } from '../modules/notifications/adapters/meta-cloud-whatsapp.adapter.js';
import { PrismaNotificationRepository } from '../modules/notifications/notification.repository.js';
import { IEventBus } from '../events/event-bus.interface.js';
import { eventBus } from '../events/event-bus.js';
import {
  createNotificationFailedEvent,
  createNotificationSentEvent,
} from '../modules/notifications/notification.events.js';
import { NotificationChannel, NotificationStatus } from '@trueco/types';
import { logger } from '../common/logger/logger.service.js';
import { runJobForTenant } from './job-context.js';

export interface WhatsAppJobPayload {
  readonly notificationId: string;
  readonly coachingId: string;
  readonly channel: NotificationChannel;
  readonly recipient: string;
  readonly recipientType: string;
  readonly templateName?: string;
  readonly templateLanguage?: string;
  readonly templateVariables?: Record<string, string>;
  readonly content: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
}

export class WhatsAppWorker {
  private worker: Worker | null = null;

  public constructor(
    private readonly whatsAppAdapter: IWhatsAppAdapter = new MetaCloudWhatsAppAdapter(),
    private readonly notificationRepository: PrismaNotificationRepository = new PrismaNotificationRepository(),
    private readonly bus: IEventBus = eventBus,
  ) {}

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.WHATSAPP,
      async (job: Job<WhatsAppJobPayload>) => {
        return runJobForTenant(job, () => this.processJob(job));
      },
      {
        connection: redis,
        concurrency: 10,
        limiter: {
          max: 50, // 50 messages
          duration: 1000, // per second (Meta rate limit compliance)
        },
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[WhatsAppWorker] Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[WhatsAppWorker] Job ${job?.id} failed:`, err);
    });

    logger.info('[WhatsAppWorker] Worker started listening to whatsapp-queue');
    return this.worker;
  }

  public async processJob(job: Job<WhatsAppJobPayload>): Promise<void> {
    const payload = job.data;

    // 1. Idempotency Check: Verify if already sent
    const existing = await this.notificationRepository.findByIdempotencyKey(payload.idempotencyKey);
    if (existing && (existing.status === NotificationStatus.SENT || existing.status === NotificationStatus.DELIVERED)) {
      logger.info(
        `[WhatsAppWorker] Skipping already-processed notification (idempotencyKey: ${payload.idempotencyKey})`,
      );
      return;
    }

    // 2. Dispatch via Adapter
    const result = await this.whatsAppAdapter.sendMessage({
      to: payload.recipient,
      coachingId: payload.coachingId,
      templateName: payload.templateName,
      templateLanguage: payload.templateLanguage,
      templateVariables: payload.templateVariables,
      bodyText: payload.content,
    });

    // 3. Update Database & Emit Domain Events
    if (result.status === 'SENT') {
      await this.notificationRepository.updateStatus(payload.idempotencyKey, NotificationStatus.SENT, {
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      });

      await this.bus.publish(
        createNotificationSentEvent(
          {
            notificationId: payload.notificationId,
            coachingId: payload.coachingId,
            channel: NotificationChannel.WHATSAPP,
            recipient: payload.recipient,
            providerMessageId: result.providerMessageId,
          },
          payload.correlationId || crypto.randomUUID(),
        ),
      );
    } else {
      await this.notificationRepository.updateStatus(payload.idempotencyKey, NotificationStatus.FAILED, {
        errorMessage: result.errorMessage,
      });

      await this.bus.publish(
        createNotificationFailedEvent(
          {
            notificationId: payload.notificationId,
            coachingId: payload.coachingId,
            channel: NotificationChannel.WHATSAPP,
            recipient: payload.recipient,
            errorMessage: result.errorMessage,
          },
          payload.correlationId || crypto.randomUUID(),
        ),
      );

      throw new Error(`WhatsApp send failed: ${result.errorMessage}`);
    }
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
