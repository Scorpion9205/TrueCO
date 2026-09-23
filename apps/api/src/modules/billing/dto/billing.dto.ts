import { PlanCode, SubscriptionStatus } from '@trueco/types';

export interface PlanResponseDto {
  readonly id: string;
  readonly code: PlanCode;
  readonly name: string;
  readonly priceMonthly: number;
  readonly priceYearly: number;
  readonly defaultFeatures: string[];
  readonly defaultCredits: number;
}

export interface SubscriptionResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly planCode: PlanCode;
  readonly planName: string;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date;
  readonly trialDaysRemaining: number;
  readonly currentPeriodEnd: Date;
  readonly gracePeriodEndsAt?: Date | null;
  readonly isGracePeriod: boolean;
  readonly features: string[];
  readonly aiCreditBalance: number;
}
