import { StatusCodes } from 'http-status-codes';
import { INotificationRepository } from './notification.repository.js';
import { QueueRegistry, QUEUE_NAMES } from '../../queues/queue.registry.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  FailedNotificationQueryDto,
  NotificationResponseDto,
  SendNotificationDto,
} from './dto/notification.dto.js';
import { NotificationMapper } from './notification.mapper.js';
import { NotificationChannel, NotificationStatus } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class NotificationService {
  public constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly queueRegistry: QueueRegistry,
    _eventBus?: IEventBus,
  ) {}

  public async enqueueNotification(
    dto: SendNotificationDto,
    coachingId: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<NotificationResponseDto> {
    // 1. Record in database with idempotencyKey
    const record = await this.notificationRepository.createHistory({
      coachingId,
      channel: dto.channel,
      recipient: dto.recipient,
      recipientType: dto.recipientType,
      templateName: dto.templateName,
      content: dto.content,
      idempotencyKey: dto.idempotencyKey,
    });

    // 2. Dispatch to designated BullMQ queue with deterministic jobId for idempotency
    const queueName = dto.channel === NotificationChannel.WHATSAPP
      ? QUEUE_NAMES.WHATSAPP
      : QUEUE_NAMES.EMAIL;

    const queue = this.queueRegistry.getQueue(queueName);

    await queue.add(
      'send_notification',
      {
        notificationId: record.id,
        coachingId,
        channel: dto.channel,
        recipient: dto.recipient,
        recipientType: dto.recipientType,
        templateName: dto.templateName,
        templateLanguage: dto.templateLanguage,
        templateVariables: dto.templateVariables,
        subject: dto.subject,
        content: dto.content,
        idempotencyKey: dto.idempotencyKey,
        correlationId,
      },
      {
        jobId: dto.idempotencyKey, // BullMQ deduplication: jobs with same ID won't be enqueued twice
      },
    );

    logger.debug(
      `[NotificationService] Enqueued ${dto.channel} notification to ${dto.recipient} (jobId: ${dto.idempotencyKey})`,
    );

    return NotificationMapper.toResponseDto(record);
  }

  public async handleWebhookStatus(
    providerMessageId: string,
    status: NotificationStatus,
    errorMessage?: string,
  ): Promise<void> {
    const data: any = { errorMessage };
    if (status === NotificationStatus.DELIVERED) data.deliveredAt = new Date();
    if (status === NotificationStatus.READ) data.readAt = new Date();

    const updated = await this.notificationRepository.updateStatusByProviderId(
      providerMessageId,
      status,
      data,
    );

    if (updated) {
      logger.info(`[NotificationService] Webhook status updated: ${providerMessageId} -> ${status}`);
    } else {
      logger.debug(`[NotificationService] Webhook status received for unknown messageId: ${providerMessageId}`);
    }
  }

  public async getFailedNotifications(
    coachingId: string,
    query?: FailedNotificationQueryDto,
  ): Promise<NotificationResponseDto[]> {
    const list = await this.notificationRepository.findFailed(
      coachingId,
      query?.limit || 20,
      query?.offset || 0,
    );
    return list.map(NotificationMapper.toResponseDto);
  }

  public async retryNotification(id: string, coachingId: string): Promise<NotificationResponseDto> {
    const record = await this.notificationRepository.findById(id);
    if (!record || record.coachingId !== coachingId) {
      throw new AppError('NOTIFICATION_NOT_FOUND', 'Notification record not found', StatusCodes.NOT_FOUND);
    }

    // Reset status to QUEUED and re-dispatch
    const newIdempotencyKey = `${record.idempotencyKey}.retry-${Date.now()}`;
    await this.notificationRepository.updateStatus(record.idempotencyKey, NotificationStatus.QUEUED, {
      errorMessage: undefined,
    });

    const queueName = record.channel === NotificationChannel.WHATSAPP
      ? QUEUE_NAMES.WHATSAPP
      : QUEUE_NAMES.EMAIL;

    const queue = this.queueRegistry.getQueue(queueName);
    await queue.add(
      'send_notification_retry',
      {
        notificationId: record.id,
        coachingId: record.coachingId,
        channel: record.channel,
        recipient: record.recipient,
        recipientType: record.recipientType,
        templateName: record.templateName,
        content: record.content,
        idempotencyKey: record.idempotencyKey,
      },
      {
        jobId: newIdempotencyKey,
      },
    );

    return NotificationMapper.toResponseDto(record);
  }
}
