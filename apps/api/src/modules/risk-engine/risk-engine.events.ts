import { DomainEvent, RiskLevel } from '@trueco/types';

export interface RiskComputedPayload {
  readonly coachingId: string;
  readonly studentId: string;
  readonly score: number;
  readonly level: RiskLevel;
}

export interface RiskDetectedPayload {
  readonly coachingId: string;
  readonly studentId: string;
  readonly score: number;
  readonly level: RiskLevel;
  readonly narrative: string;
}

export const RISK_EVENTS = {
  RISK_COMPUTED: 'RiskComputed',
  RISK_DETECTED: 'RiskDetected',
} as const;

export function createRiskComputedEvent(
  payload: RiskComputedPayload,
  correlationId: string,
): DomainEvent<RiskComputedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: RISK_EVENTS.RISK_COMPUTED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId },
  };
}

export function createRiskDetectedEvent(
  payload: RiskDetectedPayload,
  correlationId: string,
): DomainEvent<RiskDetectedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: RISK_EVENTS.RISK_DETECTED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId },
  };
}
