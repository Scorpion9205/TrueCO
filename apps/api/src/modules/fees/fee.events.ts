import { DomainEvent, PaymentMethod } from '@trueco/types';

export interface FeePlanCreatedPayload {
  readonly feePlanId: string;
  readonly coachingId: string;
  readonly studentId: string;
  readonly finalAmount: number;
  readonly installmentsCount: number;
}

export interface FeePaidPayload {
  readonly transactionId: string;
  readonly coachingId: string;
  readonly studentId: string;
  readonly installmentId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly receiptNumber: string;
  readonly remainingBalance: number;
  readonly isFullyPaid: boolean;
}

export interface FeeWaivedPayload {
  readonly installmentId: string;
  readonly coachingId: string;
  readonly studentId: string;
  readonly waivedAmount: number;
}

export interface FeeReminderTriggeredPayload {
  readonly installmentId: string;
  readonly coachingId: string;
  readonly studentId: string;
  readonly amount: number;
  readonly dueDate: Date;
  readonly daysUntilDue: number;
  /** Reminder stage, e.g. "D-7", "D0", "D+3"; each stage is sent once per installment. */
  readonly stage: string;
}

export const FEE_EVENTS = {
  FEE_PLAN_CREATED: 'FeePlanCreated',
  FEE_PAID: 'FeePaid',
  FEE_WAIVED: 'FeeWaived',
  FEE_REMINDER_TRIGGERED: 'FeeReminderTriggered',
} as const;

export function createFeePlanCreatedEvent(
  payload: FeePlanCreatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<FeePlanCreatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: FEE_EVENTS.FEE_PLAN_CREATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createFeePaidEvent(
  payload: FeePaidPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<FeePaidPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: FEE_EVENTS.FEE_PAID,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createFeeWaivedEvent(
  payload: FeeWaivedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<FeeWaivedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: FEE_EVENTS.FEE_WAIVED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createFeeReminderTriggeredEvent(
  payload: FeeReminderTriggeredPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<FeeReminderTriggeredPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: FEE_EVENTS.FEE_REMINDER_TRIGGERED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
