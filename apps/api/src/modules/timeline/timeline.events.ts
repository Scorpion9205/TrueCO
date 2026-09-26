import { DomainEvent } from '@vargly/types';

export interface TimelineEntryRecordedPayload {
  readonly entryId: string;
  readonly coachingId: string;
  readonly studentId: string;
  readonly eventType: string;
  readonly summary: string;
}

export const TIMELINE_EVENTS = {
  TIMELINE_ENTRY_RECORDED: 'TimelineEntryRecorded',
} as const;

export function createTimelineEntryRecordedEvent(
  payload: TimelineEntryRecordedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<TimelineEntryRecordedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: TIMELINE_EVENTS.TIMELINE_ENTRY_RECORDED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
