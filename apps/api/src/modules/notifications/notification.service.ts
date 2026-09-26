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
  ResolvedRecipient,
  RecipientResolverService,
  recipientResolverService,
} from './services/recipient-resolver.service.js';
import { optOutKey, WhatsAppOptOutRepository, whatsAppOptOuts } from './whatsapp-opt-out.repository.js';
import { isKnownTemplate, renderTemplate } from './whatsapp-templates.js';
import { envConfig } from '../../config/env.config.js';

export const DAILY_LIMIT_REASON = "Today's WhatsApp limit for this institute was reached; retry tomorrow";

/** Midnight in India, the start of an institute's WhatsApp day */
export function startOfIndiaDay(now: Date = new Date()): Date {
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const india = new Date(now.getTime() + IST_OFFSET_MS);
  india.setUTCHours(0, 0, 0, 0);
  return new Date(india.getTime() - IST_OFFSET_MS);
}

export class NotificationService {
  public constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly queueRegistry: QueueRegistry,
    _eventBus?: IEventBus,
    private readonly resolver: RecipientResolverService = recipientResolverService,
    private readonly optOuts: Pick<WhatsAppOptOutRepository, 'findOptedOut'> = whatsAppOptOuts,
    private readonly dailyLimit: () => number = () =>
      envConfig.get('WHATSAPP_DAILY_LIMIT_PER_COACHING'),
  ) {}

  public async enqueueNotification(
    dto: SendNotificationDto,
    coachingId: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<NotificationResponseDto> {
    const isWhatsApp = dto.channel === NotificationChannel.WHATSAPP;

    // 1. Resolve concrete destination contact details
    const resolvedTargets = await this.resolver.resolveRecipients(dto.recipient, coachingId);
    const destinationOf = (recipient: { phone?: string; email?: string }) =>
      isWhatsApp ? recipient.phone : recipient.email;
    // Only people reachable on this channel; a group token must never be "sent" to as an address
    let targets = resolvedTargets.filter((recipient) => destinationOf(recipient));
    if (targets.length === 0) {
      throw new AppError(
        'NO_RECIPIENTS',
        `No one with a contact for ${dto.channel} was found for ${dto.recipient}`,
        StatusCodes.UNPROCESSABLE_ENTITY,
      );
    }

    // 2. People who replied STOP get nothing more until they reply START
    if (isWhatsApp && !dto.isReply) {
      const optedOut = await this.optOuts.findOptedOut(targets.map((t) => t.phone!));
      targets = targets.filter((t) => !optedOut.has(optOutKey(t.phone!)));
      if (targets.length === 0) {
        throw new AppError(
          'RECIPIENT_OPTED_OUT',
          `Everyone for ${dto.recipient} has opted out of WhatsApp messages`,
          StatusCodes.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // 3. Templates name the institute and the child, which differ per recipient
    const template = isKnownTemplate(dto.templateName) ? dto.templateName : undefined;
    const institute = template ? await this.resolver.instituteName(coachingId) : undefined;
    const aboutStudent =
      template && dto.studentId ? await this.resolver.studentName(dto.studentId, coachingId) : undefined;
    const messageFor = (target: ResolvedRecipient) => {
      if (!template) return { variables: dto.templateVariables, content: dto.content };
      const variables: Record<string, string> = {
        institute: institute!,
        student: aboutStudent ?? target.studentName ?? 'your child',
        ...dto.templateVariables,
      };
      return { variables, content: renderTemplate(template, variables) ?? dto.content };
    };

    // 4. Each institute gets a daily share of the WhatsApp number; owner alerts are never held back
    let allowance = Number.POSITIVE_INFINITY;
    if (isWhatsApp && !dto.isReply && !dto.recipient.startsWith('coaching:')) {
      const sentToday = await this.notificationRepository.countSince(
        coachingId,
        NotificationChannel.WHATSAPP,
        startOfIndiaDay(),
      );
      allowance = Math.max(0, this.dailyLimit() - sentToday);
    }

    const queue = this.queueRegistry.getQueue(isWhatsApp ? QUEUE_NAMES.WHATSAPP : QUEUE_NAMES.EMAIL);
    let firstRecord: any;

    for (const [index, target] of targets.entries()) {
      const destination = destinationOf(target)!;
      // Group sends fan out; each extra person gets their own key so each is sent once
      const idempotencyKey =
        index === 0 ? dto.idempotencyKey : `${dto.idempotencyKey}.${target.recipientId}`;
      const recipientType = target.recipientType || dto.recipientType;
      const { variables, content } = messageFor(target);
      const overLimit = index >= allowance;

      try {
        const record = await this.notificationRepository.createHistory({
          coachingId,
          channel: dto.channel,
          recipient: destination,
          recipientType,
          templateName: dto.templateName,
          templateVariables: variables,
          content,
          idempotencyKey,
          ...(overLimit && { failedReason: DAILY_LIMIT_REASON }),
        });
        firstRecord ??= record;
        if (overLimit) continue;

        // Deterministic jobId: BullMQ will not enqueue the same notification twice
        await queue.add(
          'send_notification',
          {
            notificationId: record.id,
            coachingId,
            channel: dto.channel,
            recipient: destination,
            recipientType,
            templateName: dto.templateName,
            templateLanguage: dto.templateLanguage,
            templateVariables: variables,
            subject: dto.subject,
            content,
            idempotencyKey,
            correlationId,
          },
          { jobId: idempotencyKey },
        );
      } catch (err) {
        if (index === 0) throw err;
        logger.error(`[NotificationService] Error fanning out to extra target ${destination}:`, err);
      }
    }

    if (targets.length > allowance) {
      logger.warn(
        `[NotificationService] Daily WhatsApp limit reached for ${coachingId}; ${targets.length - allowance} message(s) held back`,
      );
    }
    logger.debug(
      `[NotificationService] Enqueued ${dto.channel} notification to ${dto.recipient} (jobId: ${dto.idempotencyKey})`,
    );

    return NotificationMapper.toResponseDto(firstRecord);
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
        templateVariables: record.templateVariables ?? undefined,
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
