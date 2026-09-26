import { RequestContextService } from '../../common/services/request-context.service.js';
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
import { NotificationChannel, NotificationStatus } from '@vargly/types';
import { logger } from '../../common/logger/logger.service.js';

import {
  RecipientResolverService,
  recipientResolverService,
} from './services/recipient-resolver.service.js';

export class NotificationService {
  public constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly queueRegistry: QueueRegistry,
    _eventBus?: IEventBus,
    private readonly resolver: RecipientResolverService = recipientResolverService,
  ) {}

  public async enqueueNotification(
    dto: SendNotificationDto,
    coachingId: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<NotificationResponseDto> {
    // 1. Resolve concrete destination contact details
    const resolvedTargets = await this.resolver.resolveRecipients(dto.recipient, coachingId);
    const destinationOf = (recipient: { phone?: string; email?: string }) =>
      dto.channel === NotificationChannel.WHATSAPP ? recipient.phone : recipient.email;
    // Only people reachable on this channel; a group token must never be "sent" to as an address
    const targets = resolvedTargets.filter((recipient) => destinationOf(recipient));
    if (targets.length === 0) {
      throw new AppError(
        'NO_RECIPIENTS',
        `No one with a contact for ${dto.channel} was found for ${dto.recipient}`,
        StatusCodes.UNPROCESSABLE_ENTITY,
      );
    }
    const target = targets[0]!;
    const destination = destinationOf(target)!;

    // 2. Record in database with idempotencyKey
    const record = await this.notificationRepository.createHistory({
      coachingId,
      channel: dto.channel,
      recipient: destination,
      recipientType: target.recipientType || dto.recipientType,
      templateName: dto.templateName,
      content: dto.content,
      idempotencyKey: dto.idempotencyKey,
    });

    // 3. Dispatch to designated BullMQ queue with deterministic jobId for idempotency
    const queueName =
      dto.channel === NotificationChannel.WHATSAPP ? QUEUE_NAMES.WHATSAPP : QUEUE_NAMES.EMAIL;

    const queue = this.queueRegistry.getQueue(queueName);

    await queue.add(
      'send_notification',
      {
        notificationId: record.id,
        coachingId,
        channel: dto.channel,
        recipient: destination,
        recipientType: target.recipientType || dto.recipientType,
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

    // If batch/group resolution had multiple recipients, enqueue the rest
    if (targets.length > 1) {
      for (let i = 1; i < targets.length; i++) {
        const extraTarget = targets[i]!;
        const extraDest = destinationOf(extraTarget)!;

        const extraKey = `${dto.idempotencyKey}.${extraTarget.recipientId}`;
        try {
          const extraRecord = await this.notificationRepository.createHistory({
            coachingId,
            channel: dto.channel,
            recipient: extraDest,
            recipientType: extraTarget.recipientType,
            templateName: dto.templateName,
            content: dto.content,
            idempotencyKey: extraKey,
          });

          await queue.add(
            'send_notification',
            {
              notificationId: extraRecord.id,
              coachingId,
              channel: dto.channel,
              recipient: extraDest,
              recipientType: extraTarget.recipientType,
              templateName: dto.templateName,
              templateLanguage: dto.templateLanguage,
              templateVariables: dto.templateVariables,
              subject: dto.subject,
              content: dto.content,
              idempotencyKey: extraKey,
              correlationId,
            },
            {
              jobId: extraKey,
            },
          );
        } catch (err) {
          logger.error(
            `[NotificationService] Error fanning out to extra target ${extraDest}:`,
            err,
          );
        }
      }
    }

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

    // Meta's delivery receipts identify the message only by its provider id, not the tenant
    const updated = await RequestContextService.runAsSystem('whatsapp:delivery-status', () =>
      this.notificationRepository.updateStatusByProviderId(providerMessageId, status, data),
    );

    if (updated) {
      logger.info(
        `[NotificationService] Webhook status updated: ${providerMessageId} -> ${status}`,
      );
    } else {
      logger.debug(
        `[NotificationService] Webhook status received for unknown messageId: ${providerMessageId}`,
      );
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
      throw new AppError(
        'NOTIFICATION_NOT_FOUND',
        'Notification record not found',
        StatusCodes.NOT_FOUND,
      );
    }

    // Reset status to QUEUED and re-dispatch
    const newIdempotencyKey = `${record.idempotencyKey}.retry-${Date.now()}`;
    await this.notificationRepository.updateStatus(
      record.idempotencyKey,
      NotificationStatus.QUEUED,
      {
        errorMessage: undefined,
      },
    );

    const queueName =
      record.channel === NotificationChannel.WHATSAPP ? QUEUE_NAMES.WHATSAPP : QUEUE_NAMES.EMAIL;

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
