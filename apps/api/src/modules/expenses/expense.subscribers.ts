import { IEventBus } from '../../events/event-bus.interface.js';
import {
  EXPENSE_EVENTS,
  ExpenseRecordedPayload,
  ExpenseUpdatedPayload,
} from './expense.events.js';
import { DomainEvent } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class ExpenseSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(EXPENSE_EVENTS.EXPENSE_RECORDED, (event: DomainEvent<ExpenseRecordedPayload>) => {
      logger.info(
        `[ExpenseSubscribers] Expense recorded: ID ${event.payload.expenseId} ("${event.payload.title}" [${event.payload.category}], ₹${event.payload.amount})`,
      );
    });

    eventBus.subscribe(EXPENSE_EVENTS.EXPENSE_UPDATED, (event: DomainEvent<ExpenseUpdatedPayload>) => {
      logger.info(
        `[ExpenseSubscribers] Expense updated: ID ${event.payload.expenseId} ("${event.payload.title}", ₹${event.payload.amount})`,
      );
    });
  }
}
