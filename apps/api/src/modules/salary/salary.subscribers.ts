import { IEventBus } from '../../events/event-bus.interface.js';
import {
  SALARY_EVENTS,
  SalaryGeneratedPayload,
  SalaryPaidPayload,
} from './salary.events.js';
import { DomainEvent } from '@vargly/types';
import { logger } from '../../common/logger/logger.service.js';

export class SalarySubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(SALARY_EVENTS.SALARY_GENERATED, (event: DomainEvent<SalaryGeneratedPayload>) => {
      logger.info(
        `[SalarySubscribers] Salary generated: ID ${event.payload.salaryId} for teacher ${event.payload.teacherId} (${event.payload.month}/${event.payload.year}, ₹${event.payload.amount})`,
      );
    });

    eventBus.subscribe(SALARY_EVENTS.SALARY_PAID, (event: DomainEvent<SalaryPaidPayload>) => {
      logger.info(
        `[SalarySubscribers] Salary paid: ID ${event.payload.salaryId} to teacher ${event.payload.teacherId} (₹${event.payload.amount} via ${event.payload.paymentMethod})`,
      );
    });
  }
}
