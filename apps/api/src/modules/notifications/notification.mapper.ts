import { NotificationResponseDto } from './dto/notification.dto.js';
import { NotificationChannel, NotificationStatus } from '@trueco/types';

export class NotificationMapper {
  public static toResponseDto(entity: any): NotificationResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      channel: entity.channel as NotificationChannel,
      recipient: entity.recipient,
      recipientType: entity.recipientType,
      templateName: entity.templateName,
      content: entity.content,
      status: entity.status as NotificationStatus,
      providerMessageId: entity.providerMessageId,
      errorMessage: entity.errorMessage,
      idempotencyKey: entity.idempotencyKey,
      sentAt: entity.sentAt ? new Date(entity.sentAt) : null,
      deliveredAt: entity.deliveredAt ? new Date(entity.deliveredAt) : null,
      readAt: entity.readAt ? new Date(entity.readAt) : null,
      createdAt: new Date(entity.createdAt),
    };
  }
}
