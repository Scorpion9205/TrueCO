import { DomainEvent, PaymentMethod } from '@trueco/types';

export interface SalaryGeneratedPayload {
  readonly salaryId: string;
  readonly coachingId: string;
  readonly teacherId: string;
  readonly amount: number;
  readonly month: number;
  readonly year: number;
}

export interface SalaryPaidPayload {
  readonly salaryId: string;
  readonly coachingId: string;
  readonly teacherId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly paidAt: Date;
}

export const SALARY_EVENTS = {
  SALARY_GENERATED: 'SalaryGenerated',
  SALARY_PAID: 'SalaryPaid',
} as const;

export function createSalaryGeneratedEvent(
  payload: SalaryGeneratedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<SalaryGeneratedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: SALARY_EVENTS.SALARY_GENERATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createSalaryPaidEvent(
  payload: SalaryPaidPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<SalaryPaidPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: SALARY_EVENTS.SALARY_PAID,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
