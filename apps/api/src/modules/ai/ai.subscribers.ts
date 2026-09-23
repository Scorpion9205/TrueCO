import { IEventBus } from '../../events/event-bus.interface.js';
import { AiService } from './ai.service.js';
import { logger } from '../../common/logger/logger.service.js';

export class AiSubscriber {
  public constructor(_eventBus: IEventBus, _aiService: AiService) {}

  public register(): void {
    // Credits for purchases and plan upgrades are granted inside the billing settlement
    // transaction (BillingRepository.settlePayment). Adding them again here on the
    // AiCreditsPurchased / SubscriptionUpgraded events would double-credit every purchase.
    logger.info('[AiSubscriber] AI event listeners registered successfully');
  }
}
