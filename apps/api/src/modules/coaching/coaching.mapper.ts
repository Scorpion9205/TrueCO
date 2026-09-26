import { CoachingResponseDto } from './dto/coaching.dto.js';
import { effectiveSubscription } from '../billing/subscription-status.js';

export class CoachingMapper {
  public static toResponseDto(coaching: any): CoachingResponseDto {
    const activeSub = (coaching.subscriptions || [])[0] || {};
    // Days left in the trial or the paid period, whichever applies
    const { status, endsAt, daysRemaining } = effectiveSubscription(activeSub);
    const trialEndsAt = activeSub.trialEndsAt ? new Date(activeSub.trialEndsAt) : (endsAt ?? new Date());

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
        status,
        trialEndsAt,
        daysRemaining,
        features: activeSub.plan?.defaultFeatures || [],
      },
      createdAt: coaching.createdAt,
    };
  }
}
