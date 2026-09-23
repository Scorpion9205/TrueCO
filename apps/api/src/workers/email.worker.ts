import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { IEmailAdapter } from '../modules/notifications/adapters/email.adapter.interface.js';
import { SmtpEmailAdapter } from '../modules/notifications/adapters/smtp-email.adapter.js';
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

export interface EmailJobPayload {
  readonly notificationId: string;
  readonly coachingId: string;
  readonly channel: NotificationChannel;
  readonly recipient: string;
  readonly recipientType: string;
  readonly subject?: string;
  readonly content: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
}

export class EmailWorker {
  private worker: Worker | null = null;

  public constructor(
    private readonly emailAdapter: IEmailAdapter = new SmtpEmailAdapter(),
    private readonly notificationRepository: PrismaNotificationRepository = new PrismaNotificationRepository(),
    private readonly bus: IEventBus = eventBus,
  ) {}

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.EMAIL,
      async (job: Job<EmailJobPayload>) => {
        return runJobForTenant(job, () => this.processJob(job));
      },
      {
        connection: redis,
        concurrency: 20,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[EmailWorker] Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[EmailWorker] Job ${job?.id} failed:`, err);
    });

    logger.info('[EmailWorker] Worker started listening to email-queue');
    return this.worker;
  }

  public async processJob(job: Job<EmailJobPayload>): Promise<void> {
    const payload = job.data;

    // 1. Idempotency Check: Verify if already sent
    const existing = await this.notificationRepository.findByIdempotencyKey(payload.idempotencyKey);
    if (existing && (existing.status === NotificationStatus.SENT || existing.status === NotificationStatus.DELIVERED)) {
      logger.info(
        `[EmailWorker] Skipping already-processed notification (idempotencyKey: ${payload.idempotencyKey})`,
      );
      return;
    }

    // 2. Dispatch via Adapter
    const result = await this.emailAdapter.sendEmail({
      to: payload.recipient,
      subject: payload.subject || 'TrueCO Institute Notification',
      htmlBody: payload.content,
      textBody: payload.content.replace(/<[^>]*>?/gm, ''), // Basic strip HTML tags
      coachingId: payload.coachingId,
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
            channel: NotificationChannel.EMAIL,
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
            channel: NotificationChannel.EMAIL,
            recipient: payload.recipient,
            errorMessage: result.errorMessage,
          },
          payload.correlationId || crypto.randomUUID(),
        ),
      );

      throw new Error(`Email send failed: ${result.errorMessage}`);
    }
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
