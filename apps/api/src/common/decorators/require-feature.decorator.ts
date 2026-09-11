import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RequestContextService } from '../services/request-context.service.js';
import { getPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { SubscriptionStatus } from '@trueco/types';

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

      const prisma = getPrismaClient() as any;

      // 1. Fetch current active subscription with Plan details
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

      // 2. Check Subscription status
      if (sub.status === SubscriptionStatus.EXPIRED || sub.status === SubscriptionStatus.CANCELLED) {
        res.status(StatusCodes.PAYMENT_REQUIRED).json({
          error: {
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Your TrueCO subscription has expired. Please upgrade to continue.',
            currentStatus: sub.status,
            upgradeUrl: '/billing/upgrade',
          },
        });
        return;
      }

      // 3. During 60-day trial or with Enterprise/Pro plans, check if feature is enabled
      const enabledFeatures: string[] = sub.plan?.defaultFeatures || [];

      // If in TRIALING status, all features are unlocked per ADD §13
      const isTrialing = sub.status === SubscriptionStatus.TRIALING && new Date() < new Date(sub.trialEndsAt);
      const hasFeature = isTrialing || enabledFeatures.includes(featureCode) || enabledFeatures.includes('*');

      if (!hasFeature) {
        res.status(StatusCodes.PAYMENT_REQUIRED).json({
          error: {
            code: 'UPGRADE_REQUIRED',
            message: `The feature "${featureCode}" is not included in your current ${sub.plan?.code || 'STARTER'} plan`,
            requiredFeature: featureCode,
            currentPlan: sub.plan?.code,
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
