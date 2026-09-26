import { DomainEvent, NotificationChannel } from '@vargly/types';

export interface NotificationSentPayload {
  readonly notificationId: string;
  readonly coachingId: string;
  readonly channel: NotificationChannel;
  readonly recipient: string;
  readonly providerMessageId?: string;
}

export interface NotificationFailedPayload {
  readonly notificationId: string;
  readonly coachingId: string;
  readonly channel: NotificationChannel;
  readonly recipient: string;
  readonly errorMessage?: string;
}

export const NOTIFICATION_EVENTS = {
  NOTIFICATION_SENT: 'NotificationSent',
  NOTIFICATION_FAILED: 'NotificationFailed',
} as const;

export function createNotificationSentEvent(
  payload: NotificationSentPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<NotificationSentPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: NOTIFICATION_EVENTS.NOTIFICATION_SENT,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createNotificationFailedEvent(
  payload: NotificationFailedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<NotificationFailedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: NOTIFICATION_EVENTS.NOTIFICATION_FAILED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
