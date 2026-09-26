import { NotificationChannel, NotificationStatus } from '@vargly/types';

export interface SendNotificationDto {
  readonly channel: NotificationChannel;
  readonly recipient: string; // E.164 phone or email
  readonly recipientType: 'PARENT' | 'STUDENT' | 'TEACHER';
  readonly content: string;
  readonly templateName?: string;
  readonly templateLanguage?: string;
  readonly templateVariables?: Record<string, string>;
  readonly subject?: string; // For EMAIL
  readonly idempotencyKey: string;
  /** The student a message to someone else (e.g. the owner) is about, named in the template */
  readonly studentId?: string;
  /** A reply to someone who just wrote in; STOP and the daily limit cover only automatic messages */
  readonly isReply?: boolean;
}

export interface NotificationResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly channel: NotificationChannel;
  readonly recipient: string;
  readonly recipientType: string;
  readonly templateName?: string | null;
  readonly content: string;
  readonly status: NotificationStatus;
  readonly providerMessageId?: string | null;
  readonly errorMessage?: string | null;
  readonly idempotencyKey: string;
  readonly sentAt?: Date | null;
  readonly deliveredAt?: Date | null;
  readonly readAt?: Date | null;
  readonly createdAt: Date;
}

export interface FailedNotificationQueryDto {
  readonly channel?: NotificationChannel;
  readonly limit?: number;
  readonly offset?: number;
}
