import { DomainEvent } from '@trueco/types';

export interface DashboardViewedPayload {
  readonly coachingId: string;
  readonly portal: 'OWNER' | 'TEACHER';
  readonly viewedBy?: string;
}

export const DASHBOARD_EVENTS = {
  DASHBOARD_VIEWED: 'DashboardViewed',
} as const;

export function createDashboardViewedEvent(
  payload: DashboardViewedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<DashboardViewedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: DASHBOARD_EVENTS.DASHBOARD_VIEWED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
