import { SubscriptionStatus } from '@vargly/types';

export interface RegisterCoachingDto {
  readonly coachingName: string;
  readonly phone: string;
  readonly email: string;
  readonly address?: string;
  readonly city?: string;
  readonly state?: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly ownerPhone: string;
  readonly ownerPassword: string;
  readonly timezone?: string;
  readonly currency?: string;
}

export interface CoachingResponseDto {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly phone: string;
  readonly email: string;
  readonly address?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly logoUrl?: string | null;
  readonly timezone: string;
  readonly currency: string;
  readonly subscription: {
    readonly status: SubscriptionStatus;
    readonly trialEndsAt: Date;
    readonly daysRemaining: number;
    readonly features: string[];
  };
  readonly createdAt: Date;
}
