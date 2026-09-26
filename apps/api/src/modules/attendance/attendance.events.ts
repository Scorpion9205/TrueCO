import { DomainEvent, AttendanceStatus } from '@vargly/types';

export interface AttendanceRecordPayload {
  readonly studentId: string;
  readonly status: AttendanceStatus;
  readonly remarks?: string;
}

export interface AttendanceMarkedPayload {
  readonly sessionId: string;
  readonly coachingId: string;
  readonly batchId: string;
  readonly sessionDate: Date;
  readonly markedBy?: string;
  readonly records: AttendanceRecordPayload[];
}

export const ATTENDANCE_EVENTS = {
  ATTENDANCE_MARKED: 'AttendanceMarked',
} as const;

export function createAttendanceMarkedEvent(
  payload: AttendanceMarkedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<AttendanceMarkedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: ATTENDANCE_EVENTS.ATTENDANCE_MARKED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
