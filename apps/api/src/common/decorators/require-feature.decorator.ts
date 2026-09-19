import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RequestContextService } from '../services/request-context.service.js';
import { getPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { SubscriptionStatus } from '@trueco/types';
import { queueRegistry } from '../../queues/queue.registry.js';
import { logger } from '../logger/logger.service.js';

export interface RequireFeatureOptions {
  featureCode: string;
}

export function requireFeature(featureCode: string) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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

      // 1. Hot-path Redis cache check for subscription capabilities
      const cacheKey = `tenant:${coachingId}:subscription_features`;
      let cachedData: {
        status: SubscriptionStatus;
        isTrialing: boolean;
        enabledFeatures: string[];
        planCode?: string;
      } | null = null;

      try {
        const redis = queueRegistry.getRedisClient();
        if (redis && redis.status === 'ready') {
          const raw = await redis.get(cacheKey);
          if (raw) {
            cachedData = JSON.parse(raw);
          }
        }
      } catch (cacheErr) {
        logger.debug('[RequireFeature] Redis cache lookup failed, falling back to database query');
      }

      if (!cachedData) {
        const prisma = getPrismaClient() as any;

        const sub = await prisma.subscription.findFirst({
          where: { coachingId, isActive: true },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        });

        if (!sub) {
          res.status(StatusCodes.PAYMENT_REQUIRED).json({
            error: {
              code: 'NO_ACTIVE_SUBSCRIPTION',
              message: 'No active subscription found for this coaching institute',
              upgradeUrl: '/billing/plans',
            },
          });
          return;
        }

        const isTrialing = sub.status === SubscriptionStatus.TRIALING && new Date() < new Date(sub.trialEndsAt);
        const enabledFeatures: string[] = sub.plan?.defaultFeatures || [];

        cachedData = {
          status: sub.status,
          isTrialing,
          enabledFeatures,
          planCode: sub.plan?.code,
        };

        try {
          const redis = queueRegistry.getRedisClient();
          if (redis && redis.status === 'ready') {
            await redis.setex(cacheKey, 600, JSON.stringify(cachedData)); // Cache for 10 minutes
          }
        } catch {
          // Redis cache set failure is non-fatal
        }
      }

      // 2. Check Subscription status
      if (cachedData.status === SubscriptionStatus.EXPIRED || cachedData.status === SubscriptionStatus.CANCELLED) {
        res.status(StatusCodes.PAYMENT_REQUIRED).json({
          error: {
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Your TrueCO subscription has expired. Please upgrade to continue.',
            currentStatus: cachedData.status,
            upgradeUrl: '/billing/upgrade',
          },
        });
        return;
      }

      // 3. During 60-day trial or with Enterprise/Pro plans, check if feature is enabled
      const hasFeature =
        cachedData.isTrialing ||
        cachedData.enabledFeatures.includes(featureCode) ||
        cachedData.enabledFeatures.includes('*');

      if (!hasFeature) {
        res.status(StatusCodes.PAYMENT_REQUIRED).json({
          error: {
            code: 'UPGRADE_REQUIRED',
            message: `The feature "${featureCode}" is not included in your current ${cachedData.planCode || 'STARTER'} plan`,
            requiredFeature: featureCode,
            currentPlan: cachedData.planCode,
            upgradeUrl: '/billing/upgrade',
          },
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function invalidateSubscriptionFeatureCache(coachingId: string): Promise<void> {
  try {
    const redis = queueRegistry.getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.del(`tenant:${coachingId}:subscription_features`);
    }
  } catch {
    // Non-fatal
  }
}

