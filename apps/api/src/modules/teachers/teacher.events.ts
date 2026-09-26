import { DomainEvent } from '@vargly/types';

export interface TeacherCreatedPayload {
  readonly teacherId: string;
  readonly coachingId: string;
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
}

export const TEACHER_EVENTS = {
  TEACHER_CREATED: 'TeacherCreated',
  TEACHER_UPDATED: 'TeacherUpdated',
} as const;

export function createTeacherCreatedEvent(
  payload: TeacherCreatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<TeacherCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: TEACHER_EVENTS.TEACHER_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
