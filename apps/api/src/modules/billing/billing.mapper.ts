import { PlanResponseDto, SubscriptionResponseDto } from './dto/billing.dto.js';
import { PlanCode, SubscriptionStatus } from '@trueco/types';

export class BillingMapper {
  public static toPlanDto(entity: any): PlanResponseDto {
    return {
      id: entity.id,
      code: entity.code as PlanCode,
      name: entity.name,
      priceMonthly: Number(entity.priceMonthly),
      priceYearly: Number(entity.priceYearly),
      defaultFeatures: entity.defaultFeatures || [],
      defaultCredits: entity.defaultCredits || 0,
    };
  }

  public static toSubscriptionDto(sub: any, wallet?: any): SubscriptionResponseDto {
    const now = new Date();
    const trialEndsAt = new Date(sub.trialEndsAt);
    const diffMs = trialEndsAt.getTime() - now.getTime();
    const trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const isGracePeriod = sub.status === SubscriptionStatus.GRACE;
    const features: string[] = sub.plan?.defaultFeatures || [];
    const aiCreditBalance = wallet ? wallet.balance : 0;

    return {
      id: sub.id,
      coachingId: sub.coachingId,
      planCode: sub.plan?.code as PlanCode,
      planName: sub.plan?.name || 'Default Plan',
      status: sub.status as SubscriptionStatus,
      trialEndsAt,
      trialDaysRemaining,
      currentPeriodEnd: new Date(sub.currentPeriodEnd),
      gracePeriodEndsAt: sub.gracePeriodEndsAt ? new Date(sub.gracePeriodEndsAt) : null,
      isGracePeriod,
      features,
      aiCreditBalance,
    };
  }
}
