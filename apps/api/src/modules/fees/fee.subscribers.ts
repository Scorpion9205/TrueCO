import { IEventBus } from '../../events/event-bus.interface.js';
import {
  FEE_EVENTS,
  FeePaidPayload,
  FeePlanCreatedPayload,
  FeeWaivedPayload,
} from './fee.events.js';
import { DomainEvent } from '@trueco/types';
import { logger } from '../../common/logger/logger.service.js';

export class FeeSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(FEE_EVENTS.FEE_PLAN_CREATED, (event: DomainEvent<FeePlanCreatedPayload>) => {
      logger.info(
        `[FeeSubscribers] Fee plan created: ID ${event.payload.feePlanId} for student ${event.payload.studentId} (Amount: ₹${event.payload.finalAmount})`,
      );
    });

    eventBus.subscribe(FEE_EVENTS.FEE_PAID, (event: DomainEvent<FeePaidPayload>) => {
      logger.info(
        `[FeeSubscribers] Fee payment recorded: Receipt ${event.payload.receiptNumber} for student ${event.payload.studentId} (Amount: ₹${event.payload.amount})`,
      );
    });

    eventBus.subscribe(FEE_EVENTS.FEE_WAIVED, (event: DomainEvent<FeeWaivedPayload>) => {
      logger.info(
        `[FeeSubscribers] Installment ${event.payload.installmentId} waived for student ${event.payload.studentId} (Waived: ₹${event.payload.waivedAmount})`,
      );
    });
  }
}
