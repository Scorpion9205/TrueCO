import { PlanCode, SubscriptionStatus } from '@vargly/types';

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
  /** Price of one AI credit, for buying more */
  readonly aiCreditPricePaise: number;
}

export interface BillingPaymentResponseDto {
  readonly id: string;
  /** The gateway order it paid for (what POST /orders returned as orderId) */
  readonly orderId: string;
  readonly type: 'PLAN_UPGRADE' | 'AI_CREDITS';
  readonly status: 'PAID' | 'FAILED';
  readonly planCode?: PlanCode | null;
  readonly billingCycle?: string | null;
  readonly credits?: number | null;
  /** Rupees */
  readonly amount: number;
  readonly invoiceNumber?: string | null;
  readonly paidAt?: Date | null;
  readonly createdAt: Date;
}
