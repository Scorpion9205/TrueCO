import { DomainEvent } from '@trueco/types';

export interface NoticeCreatedPayload {
  readonly noticeId: string;
  readonly coachingId: string;
  readonly batchId?: string | null;
  readonly title: string;
  /** Absent on events recorded before it was added */
  readonly content?: string;
  readonly targetAudience: string;
}

export interface NoticeUpdatedPayload {
  readonly noticeId: string;
  readonly coachingId: string;
  readonly title: string;
}

export interface NoticeDeletedPayload {
  readonly noticeId: string;
  readonly coachingId: string;
}

export const NOTICE_EVENTS = {
  NOTICE_CREATED: 'NoticeCreated',
  NOTICE_UPDATED: 'NoticeUpdated',
  NOTICE_DELETED: 'NoticeDeleted',
} as const;

export function createNoticeCreatedEvent(
  payload: NoticeCreatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<NoticeCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: NOTICE_EVENTS.NOTICE_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createNoticeUpdatedEvent(
  payload: NoticeUpdatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<NoticeUpdatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: NOTICE_EVENTS.NOTICE_UPDATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createNoticeDeletedEvent(
  payload: NoticeDeletedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<NoticeDeletedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: NOTICE_EVENTS.NOTICE_DELETED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
