import { DomainEvent } from '@trueco/types';

export interface StudentCreatedPayload {
  readonly studentId: string;
  readonly coachingId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string | null;
  readonly email?: string | null;
}

export interface StudentUpdatedPayload {
  readonly studentId: string;
  readonly coachingId: string;
  readonly changes: Record<string, unknown>;
}

export const STUDENT_EVENTS = {
  STUDENT_CREATED: 'StudentCreated',
  STUDENT_UPDATED: 'StudentUpdated',
} as const;

export function createStudentCreatedEvent(
  payload: StudentCreatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<StudentCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: STUDENT_EVENTS.STUDENT_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createStudentUpdatedEvent(
  payload: StudentUpdatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<StudentUpdatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: STUDENT_EVENTS.STUDENT_UPDATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
