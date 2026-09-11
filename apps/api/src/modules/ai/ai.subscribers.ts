import { IEventBus } from '../../events/event-bus.interface.js';
import { DomainEvent } from '@trueco/types';
import { AiService } from './ai.service.js';
import { logger } from '../../common/logger/logger.service.js';

export class AiSubscriber {
  public constructor(
    private readonly eventBus: IEventBus,
    private readonly aiService: AiService,
  ) {}

  public register(): void {
    // 1. Listen for AI credits purchase from Billing module
    this.eventBus.subscribe('AiCreditsPurchased', async (event: DomainEvent<any>) => {
      try {
        const { credits, coachingId } = event.payload;
        if (coachingId && credits) {
          logger.info(`[AiSubscriber] Crediting ${credits} AI credits for coaching: ${coachingId}`);
          await this.aiService.addCredits(
            coachingId,
            { credits, reason: 'Subscription purchase/top-up' },
            event.metadata?.userId,
            event.metadata?.correlationId,
          );
        }
      } catch (err) {
        logger.error('[AiSubscriber] Error crediting AI wallet on purchase event:', err);
      }
    });

    // 2. Listen for Subscription upgraded
    this.eventBus.subscribe('SubscriptionUpgraded', async (event: DomainEvent<any>) => {
      try {
        const { coachingId, planCode } = event.payload;
        if (coachingId && planCode === 'PRO_AI') {
          logger.info(`[AiSubscriber] Adding 500 bonus AI credits for Pro AI upgrade: ${coachingId}`);
          await this.aiService.addCredits(
            coachingId,
            { credits: 500, reason: 'Pro AI Plan Upgrade Bonus' },
            event.metadata?.userId,
            event.metadata?.correlationId,
          );
        }
      } catch (err) {
        logger.error('[AiSubscriber] Error allocating plan bonus credits:', err);
      }
    });

    logger.info('[AiSubscriber] AI event listeners registered successfully');
  }
}
