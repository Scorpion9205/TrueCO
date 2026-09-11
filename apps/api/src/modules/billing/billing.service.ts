import { StatusCodes } from 'http-status-codes';
import { IBillingRepository } from './billing.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  PlanResponseDto,
  PurchaseCreditsDto,
  SubscriptionResponseDto,
  UpgradePlanDto,
} from './dto/billing.dto.js';
import { BillingMapper } from './billing.mapper.js';
import {
  createAiCreditsPurchasedEvent,
  createSubscriptionUpgradedEvent,
} from './billing.events.js';
import { SubscriptionStatus } from '@trueco/types';

export class BillingService {
  public constructor(
    private readonly billingRepository: IBillingRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async getCurrentSubscription(coachingId: string): Promise<SubscriptionResponseDto> {
    const sub = await this.billingRepository.findCurrentSubscription(coachingId);
    if (!sub) {
      throw new AppError('SUBSCRIPTION_NOT_FOUND', 'No active subscription found', StatusCodes.NOT_FOUND);
    }

    const wallet = await this.billingRepository.getCreditWallet(coachingId);
    return BillingMapper.toSubscriptionDto(sub, wallet);
  }

  public async getPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.billingRepository.findAllActivePlans();
    return plans.map(BillingMapper.toPlanDto);
  }

  public async upgradePlan(
    dto: UpgradePlanDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<SubscriptionResponseDto> {
    const targetPlan = await this.billingRepository.findPlanByCode(dto.planCode);
    if (!targetPlan) {
      throw new AppError('PLAN_NOT_FOUND', `Plan "${dto.planCode}" does not exist`, StatusCodes.NOT_FOUND);
    }

    const now = new Date();
    const currentPeriodEnd = new Date(now);
    if (dto.billingCycle === 'MONTHLY') {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    } else {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 365);
    }

    const updatedSub = await this.billingRepository.updateSubscriptionPlan(
      coachingId,
      targetPlan.id,
      SubscriptionStatus.ACTIVE,
      currentPeriodEnd,
    );

    // Grant default plan credits if any
    if (targetPlan.defaultCredits > 0) {
      await this.billingRepository.addCredits(coachingId, targetPlan.defaultCredits);
    }

    const wallet = await this.billingRepository.getCreditWallet(coachingId);
    const responseDto = BillingMapper.toSubscriptionDto(updatedSub, wallet);

    await this.eventBus.publish(
      createSubscriptionUpgradedEvent(
        {
          coachingId,
          newPlan: dto.planCode,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async purchaseCredits(
    dto: PurchaseCreditsDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<{ newBalance: number }> {
    const updatedWallet = await this.billingRepository.addCredits(coachingId, dto.credits);

    await this.eventBus.publish(
      createAiCreditsPurchasedEvent(
        {
          coachingId,
          creditsAdded: dto.credits,
          newBalance: updatedWallet.balance,
        },
        correlationId,
        userId,
      ),
    );

    return { newBalance: updatedWallet.balance };
  }
}
