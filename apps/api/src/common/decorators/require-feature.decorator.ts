import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RequestContextService } from '../services/request-context.service.js';
import { getPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { SubscriptionStatus } from '@vargly/types';
import { queueRegistry } from '../../queues/queue.registry.js';
import { logger } from '../logger/logger.service.js';

export interface SubscriptionState {
  readonly status: SubscriptionStatus;
  readonly planCode?: string;
  readonly enabledFeatures: string[];
  /** ISO timestamp until which the coaching may use the product (trial end, or period end plus grace) */
  readonly accessUntil: string;
}

export type SubscriptionAccess =
  | { readonly allowed: true; readonly state: SubscriptionState; readonly isTrialing: boolean }
  | {
      readonly allowed: false;
      readonly code: string;
      readonly message: string;
      readonly state?: SubscriptionState;
    };

const CACHE_TTL_SECONDS = 600;
const cacheKey = (coachingId: string) => `tenant:${coachingId}:subscription_state:v2`;

/** Loads the coaching's current subscription, cached in Redis. Returns null when there is none. */
export async function loadSubscriptionState(coachingId: string): Promise<SubscriptionState | null> {
  try {
    const redis = queueRegistry.getRedisClient();
    if (redis.status === 'ready') {
      const raw = await redis.get(cacheKey(coachingId));
      if (raw) return JSON.parse(raw) as SubscriptionState;
    }
  } catch {
    logger.debug('[Subscription] Redis cache lookup failed, falling back to database');
  }

  const sub = await RequestContextService.runForTenant(coachingId, () =>
    (getPrismaClient() as any).subscription.findFirst({
      where: { isActive: true },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  );
  if (!sub) return null;

  const accessUntil =
    sub.status === SubscriptionStatus.TRIALING
      ? sub.trialEndsAt
      : (sub.gracePeriodEndsAt ?? sub.currentPeriodEnd);
  const state: SubscriptionState = {
    status: sub.status,
    planCode: sub.plan?.code,
    enabledFeatures: sub.plan?.defaultFeatures ?? [],
    accessUntil: new Date(accessUntil).toISOString(),
  };

  try {
    const redis = queueRegistry.getRedisClient();
    if (redis.status === 'ready')
      await redis.setex(cacheKey(coachingId), CACHE_TTL_SECONDS, JSON.stringify(state));
  } catch {
    // Cache write failure is non-fatal
  }
  return state;
}

/**
 * Single rule for whether a coaching may use the product. Dates are enforced here rather than
 * trusting the status column, which is only updated when the expiration scheduler runs.
 */
export function evaluateSubscriptionAccess(
  state: SubscriptionState | null,
  now = new Date(),
): SubscriptionAccess {
  if (!state) {
    return {
      allowed: false,
      code: 'NO_ACTIVE_SUBSCRIPTION',
      message: 'No active subscription found for this coaching institute',
    };
  }
  if (
    state.status === SubscriptionStatus.EXPIRED ||
    state.status === SubscriptionStatus.CANCELLED
  ) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_EXPIRED',
      message: 'Your Vargly subscription has expired. Please upgrade to continue.',
      state,
    };
  }
  if (now.getTime() > new Date(state.accessUntil).getTime()) {
    return state.status === SubscriptionStatus.TRIALING
      ? {
          allowed: false,
          code: 'TRIAL_EXPIRED',
          message: 'Your free trial has ended. Choose a plan to continue.',
          state,
        }
      : {
          allowed: false,
          code: 'SUBSCRIPTION_EXPIRED',
          message: 'Your Vargly subscription has expired. Please upgrade to continue.',
          state,
        };
  }
  return { allowed: true, state, isTrialing: state.status === SubscriptionStatus.TRIALING };
}

function respondPaymentRequired(
  res: Response,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): void {
  res.status(StatusCodes.PAYMENT_REQUIRED).json({
    error: { code, message, upgradeUrl: '/billing/upgrade', ...extra },
  });
}

/** Blocks every request from a coaching whose trial or subscription has lapsed (402). */
export function requireActiveSubscription() {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const coachingId = RequestContextService.getCoachingId();
    if (!coachingId) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: {
          code: 'TENANT_CONTEXT_REQUIRED',
          message: 'This endpoint is only available to coaching accounts',
        },
      });
      return;
    }

    const access = evaluateSubscriptionAccess(await loadSubscriptionState(coachingId));
    if (!access.allowed) {
      respondPaymentRequired(res, access.code, access.message, {
        currentStatus: access.state?.status,
      });
      return;
    }
    next();
  };
}

/** Requires an active subscription whose plan includes the feature (all features during a trial). */
export function requireFeature(featureCode: string) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const coachingId = RequestContextService.getCoachingId();
    if (!coachingId) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required to evaluate feature permissions',
        },
      });
      return;
    }

    const access = evaluateSubscriptionAccess(await loadSubscriptionState(coachingId));
    if (!access.allowed) {
      respondPaymentRequired(res, access.code, access.message, {
        currentStatus: access.state?.status,
      });
      return;
    }

    const { state } = access;
    const hasFeature =
      access.isTrialing ||
      state.enabledFeatures.includes(featureCode) ||
      state.enabledFeatures.includes('*');
    if (!hasFeature) {
      respondPaymentRequired(
        res,
        'UPGRADE_REQUIRED',
        `The feature "${featureCode}" is not included in your current ${state.planCode || 'STARTER'} plan`,
        { requiredFeature: featureCode, currentPlan: state.planCode },
      );
      return;
    }
    next();
  };
}

export async function invalidateSubscriptionFeatureCache(coachingId: string): Promise<void> {
  try {
    const redis = queueRegistry.getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.del(cacheKey(coachingId));
    }
  } catch {
    // Non-fatal
  }
}
