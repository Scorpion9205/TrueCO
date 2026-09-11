import { DomainEvent } from '@trueco/types';

export interface BatchCreatedPayload {
  readonly batchId: string;
  readonly coachingId: string;
  readonly name: string;
  readonly academicYear: string;
}

export interface StudentEnrolledInBatchPayload {
  readonly coachingId: string;
  readonly batchId: string;
  readonly studentId: string;
  readonly joinedAt: Date;
}

export const BATCH_EVENTS = {
  BATCH_CREATED: 'BatchCreated',
  STUDENT_ENROLLED_IN_BATCH: 'StudentEnrolledInBatch',
} as const;

export function createBatchCreatedEvent(
  payload: BatchCreatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<BatchCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: BATCH_EVENTS.BATCH_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createStudentEnrolledInBatchEvent(
  payload: StudentEnrolledInBatchPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<StudentEnrolledInBatchPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: BATCH_EVENTS.STUDENT_ENROLLED_IN_BATCH,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
