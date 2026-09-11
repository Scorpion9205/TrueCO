import { DomainEvent } from '@trueco/types';

export interface CoachingCreatedPayload {
  readonly coachingId: string;
  readonly coachingCode: string;
  readonly coachingName: string;
  readonly ownerId: string;
  readonly ownerEmail: string;
  readonly trialEndsAt: Date;
}

export const COACHING_EVENTS = {
  COACHING_CREATED: 'CoachingCreated',
  SUBSCRIPTION_TRIAL_STARTED: 'SubscriptionTrialStarted',
} as const;

export function createCoachingCreatedEvent(
  payload: CoachingCreatedPayload,
  correlationId: string,
): DomainEvent<CoachingCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: COACHING_EVENTS.COACHING_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: {
      correlationId,
      userId: payload.ownerId,
    },
  };
}
