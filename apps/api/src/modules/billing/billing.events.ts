import { DomainEvent, PlanCode, SubscriptionStatus } from '@trueco/types';

export interface SubscriptionUpgradedPayload {
  readonly coachingId: string;
  readonly previousPlan?: PlanCode;
  readonly newPlan: PlanCode;
  readonly status: SubscriptionStatus;
  readonly currentPeriodEnd: Date;
}

export interface SubscriptionExpiringPayload {
  readonly coachingId: string;
  readonly planCode: PlanCode;
  readonly trialEndsAt: Date;
  readonly daysRemaining: number;
}

export interface AiCreditsPurchasedPayload {
  readonly coachingId: string;
  readonly creditsAdded: number;
  readonly newBalance: number;
}

export const BILLING_EVENTS = {
  SUBSCRIPTION_UPGRADED: 'SubscriptionUpgraded',
  SUBSCRIPTION_EXPIRING: 'SubscriptionExpiring',
  AI_CREDITS_PURCHASED: 'AiCreditsPurchased',
} as const;

export function createSubscriptionUpgradedEvent(
  payload: SubscriptionUpgradedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<SubscriptionUpgradedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: BILLING_EVENTS.SUBSCRIPTION_UPGRADED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createSubscriptionExpiringEvent(
  payload: SubscriptionExpiringPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<SubscriptionExpiringPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: BILLING_EVENTS.SUBSCRIPTION_EXPIRING,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createAiCreditsPurchasedEvent(
  payload: AiCreditsPurchasedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<AiCreditsPurchasedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: BILLING_EVENTS.AI_CREDITS_PURCHASED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
