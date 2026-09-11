import { DomainEvent } from '@trueco/types';

export interface ReportGeneratedPayload {
  readonly coachingId: string;
  readonly reportType: string;
  readonly format: string;
}

export const REPORT_EVENTS = {
  REPORT_GENERATED: 'ReportGenerated',
} as const;

export function createReportGeneratedEvent(
  payload: ReportGeneratedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<ReportGeneratedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: REPORT_EVENTS.REPORT_GENERATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
