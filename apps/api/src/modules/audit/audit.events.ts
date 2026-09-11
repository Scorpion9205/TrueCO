import { DomainEvent } from '@trueco/types';

export interface AuditLogCreatedPayload {
  readonly logId: string;
  readonly coachingId: string;
  readonly action: string;
  readonly entityName: string;
  readonly entityId: string;
}

export const AUDIT_EVENTS = {
  AUDIT_LOG_CREATED: 'AuditLogCreated',
} as const;

export function createAuditLogCreatedEvent(
  payload: AuditLogCreatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<AuditLogCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: AUDIT_EVENTS.AUDIT_LOG_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
