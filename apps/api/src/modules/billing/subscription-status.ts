import { SubscriptionStatus } from '@vargly/types';

/**
 * A subscription as the product treats it right now. The stored status only changes when the
 * daily expiry scan runs, so a trial that ended this morning is reported as ended from its end
 * time, matching what requireActiveSubscription already enforces.
 */
export function effectiveSubscription(
  sub: {
    status?: string | null;
    trialEndsAt?: Date | string | null;
    currentPeriodEnd?: Date | string | null;
    gracePeriodEndsAt?: Date | string | null;
  },
  now: Date = new Date(),
): { status: SubscriptionStatus; endsAt: Date | null; daysRemaining: number } {
  const stored = (sub.status as SubscriptionStatus) || SubscriptionStatus.TRIALING;
  const end =
    stored === SubscriptionStatus.TRIALING
      ? sub.trialEndsAt
      : (sub.gracePeriodEndsAt ?? sub.currentPeriodEnd);
  const endsAt = end ? new Date(end) : null;
  const daysRemaining = endsAt
    ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000))
    : 0;
  const lapsed =
    endsAt !== null &&
    endsAt.getTime() <= now.getTime() &&
    [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE, SubscriptionStatus.PAST_DUE].includes(stored);
  return { status: lapsed ? SubscriptionStatus.EXPIRED : stored, endsAt, daysRemaining };
}
