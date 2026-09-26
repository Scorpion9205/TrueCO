import { DomainEvent } from '@vargly/types';

export interface ParentCreatedPayload {
  readonly parentId: string;
  readonly coachingId: string;
  readonly name: string;
  readonly phone: string;
}

export interface StudentParentLinkedPayload {
  readonly coachingId: string;
  readonly studentId: string;
  readonly parentId: string;
  readonly isPrimary: boolean;
}

export const PARENT_EVENTS = {
  PARENT_CREATED: 'ParentCreated',
  STUDENT_PARENT_LINKED: 'StudentParentLinked',
} as const;

export function createParentCreatedEvent(
  payload: ParentCreatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<ParentCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: PARENT_EVENTS.PARENT_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createStudentParentLinkedEvent(
  payload: StudentParentLinkedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<StudentParentLinkedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: PARENT_EVENTS.STUDENT_PARENT_LINKED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
