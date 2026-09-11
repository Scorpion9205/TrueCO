import { DomainEvent } from '@trueco/types';

export interface ExpenseRecordedPayload {
  readonly expenseId: string;
  readonly coachingId: string;
  readonly title: string;
  readonly category: string;
  readonly amount: number;
}

export interface ExpenseUpdatedPayload {
  readonly expenseId: string;
  readonly coachingId: string;
  readonly title: string;
  readonly amount: number;
}

export const EXPENSE_EVENTS = {
  EXPENSE_RECORDED: 'ExpenseRecorded',
  EXPENSE_UPDATED: 'ExpenseUpdated',
} as const;

export function createExpenseRecordedEvent(
  payload: ExpenseRecordedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<ExpenseRecordedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: EXPENSE_EVENTS.EXPENSE_RECORDED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}

export function createExpenseUpdatedEvent(
  payload: ExpenseUpdatedPayload,
  correlationId: string,
  userId?: string,
): DomainEvent<ExpenseUpdatedPayload> {
  return {
    eventId: crypto.randomUUID(),
    eventName: EXPENSE_EVENTS.EXPENSE_UPDATED,
    coachingId: payload.coachingId,
    occurredAt: new Date(),
    payload,
    metadata: { correlationId, userId },
  };
}
