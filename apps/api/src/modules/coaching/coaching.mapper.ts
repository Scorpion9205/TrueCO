import { CoachingResponseDto } from './dto/coaching.dto.js';
import { SubscriptionStatus } from '@vargly/types';

export class CoachingMapper {
  public static toResponseDto(coaching: any): CoachingResponseDto {
    const activeSub = (coaching.subscriptions || [])[0] || {};
    const trialEndsAt = activeSub.trialEndsAt ? new Date(activeSub.trialEndsAt) : new Date();
    const now = new Date();
    const diffTime = trialEndsAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      id: coaching.id,
      name: coaching.name,
      code: coaching.code,
      phone: coaching.phone,
      email: coaching.email,
      address: coaching.address,
      city: coaching.city,
      state: coaching.state,
      logoUrl: coaching.logoUrl,
      timezone: coaching.timezone,
      currency: coaching.currency,
      subscription: {
        status: (activeSub.status as SubscriptionStatus) || SubscriptionStatus.TRIALING,
        trialEndsAt,
        daysRemaining,
        features: activeSub.plan?.defaultFeatures || [],
      },
      createdAt: coaching.createdAt,
    };
  }
}
