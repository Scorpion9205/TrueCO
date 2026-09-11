import { DomainEvent } from '@trueco/types';

export interface HomeworkCreatedPayload {
  readonly homeworkId: string;
  readonly coachingId: string;
  readonly batchId: string;
  readonly title: string;
  readonly dueDate: Date;
  readonly attachmentUrl?: string | null;
}

export interface HomeworkUpdatedPayload {
  readonly homeworkId: string;
  readonly coachingId: string;
  readonly batchId: string;
  readonly title: string;
  readonly dueDate: Date;
}

export const HOMEWORK_EVENTS = {
  HOMEWORK_CREATED: 'HomeworkCreated',
  HOMEWORK_UPDATED: 'HomeworkUpdated',
} as const;

export function createHomeworkCreatedEvent(
  payload: HomeworkCreatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<HomeworkCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: HOMEWORK_EVENTS.HOMEWORK_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createHomeworkUpdatedEvent(
  payload: HomeworkUpdatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<HomeworkUpdatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: HOMEWORK_EVENTS.HOMEWORK_UPDATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
