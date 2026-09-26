import { invalidateSubscriptionFeatureCache } from '../../common/decorators/require-feature.decorator.js';
import { IBillingRepository } from './billing.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { createSubscriptionExpiringEvent } from './billing.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { SubscriptionStatus } from '@vargly/types';

export class SubscriptionExpirationScheduler {
  public constructor(
    private readonly billingRepository: IBillingRepository,
    private readonly eventBus: IEventBus,
  ) {}

  /** Scans subscriptions of every coaching; per-tenant events then run in that tenant's context. */
  public async runDailyExpirationCheck(): Promise<number> {
    return RequestContextService.runAsSystem('scheduler:subscription-expiration', () => this.scanSubscriptions());
  }

  private async scanSubscriptions(): Promise<number> {
    logger.info('[SubscriptionExpirationScheduler] Running daily scan for expiring coaching subscriptions...');

    const now = new Date();
    const alertThreshold = new Date(now);
    alertThreshold.setDate(alertThreshold.getDate() + 7);

    const expiringList = await this.billingRepository.findExpiringSubscriptions(alertThreshold);
    let processedCount = 0;

    for (const sub of expiringList) {
      // Trials end at trialEndsAt; paid plans at the end of the current billing period
      const trialEndsAt = new Date(
        sub.status === SubscriptionStatus.TRIALING ? sub.trialEndsAt : sub.currentPeriodEnd,
      );
      const diffMs = trialEndsAt.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      if (daysRemaining === 0 && sub.status !== SubscriptionStatus.EXPIRED) {
        // Expire subscription
        await this.billingRepository.updateSubscriptionStatus(sub.id, SubscriptionStatus.EXPIRED);
        await invalidateSubscriptionFeatureCache(sub.coachingId);
        await this.eventBus.publish(
          createSubscriptionExpiringEvent(
            {
              coachingId: sub.coachingId,
              planCode: sub.plan?.code || 'FREE_FOREVER',
              trialEndsAt,
              daysRemaining: 0,
            },
            crypto.randomUUID(),
          ),
        );
        processedCount++;
      } else if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
        await this.eventBus.publish(
          createSubscriptionExpiringEvent(
            {
              coachingId: sub.coachingId,
              planCode: sub.plan?.code || 'FREE_FOREVER',
              trialEndsAt,
              daysRemaining,
            },
            crypto.randomUUID(),
          ),
        );
        processedCount++;
      }
    }

    logger.info(
      `[SubscriptionExpirationScheduler] Expiration scan complete. Processed ${processedCount} subscription alerts/expirations.`,
    );
    return processedCount;
  }
}
