import { IEventBus } from '../../events/event-bus.interface.js';
import {
  BILLING_EVENTS,
  SubscriptionUpgradedPayload,
  SubscriptionExpiringPayload,
  AiCreditsPurchasedPayload,
} from './billing.events.js';
import { DomainEvent } from '@vargly/types';
import { logger } from '../../common/logger/logger.service.js';

export class BillingSubscribers {
  public static register(eventBus: IEventBus): void {
    eventBus.subscribe(
      BILLING_EVENTS.SUBSCRIPTION_UPGRADED,
      (event: DomainEvent<SubscriptionUpgradedPayload>) => {
        logger.info(
          `[BillingSubscribers] Subscription upgraded: Coaching ${event.payload.coachingId} -> Plan ${event.payload.newPlan} (Status: ${event.payload.status})`,
        );
      },
    );

    eventBus.subscribe(
      BILLING_EVENTS.SUBSCRIPTION_EXPIRING,
      (event: DomainEvent<SubscriptionExpiringPayload>) => {
        logger.warn(
          `[BillingSubscribers] Subscription expiring: Coaching ${event.payload.coachingId} has ${event.payload.daysRemaining} days remaining on plan ${event.payload.planCode}`,
        );
      },
    );

    eventBus.subscribe(
      BILLING_EVENTS.AI_CREDITS_PURCHASED,
      (event: DomainEvent<AiCreditsPurchasedPayload>) => {
        logger.info(
          `[BillingSubscribers] AI Credits purchased: Coaching ${event.payload.coachingId} bought ${event.payload.creditsAdded} credits. New balance: ${event.payload.newBalance}`,
        );
      },
    );
  }
}
