import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingService } from '../../modules/billing/billing.service.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { PlanCode, SubscriptionStatus } from '@vargly/types';
import { BILLING_EVENTS } from '../../modules/billing/billing.events.js';
import { SubscriptionExpirationScheduler } from '../../modules/billing/billing.cron.js';
import { MockPaymentGatewayAdapter } from '../../modules/billing/adapters/mock-payment-gateway.adapter.js';
import { InMemoryBillingRepository } from '../fakes/in-memory-billing.repository.js';

describe('BillingService & Subscription Lifecycle', () => {
  let billingService: BillingService;
  let billingRepo: InMemoryBillingRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    billingRepo = new InMemoryBillingRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    billingService = new BillingService(billingRepo, mockEventBus, new MockPaymentGatewayAdapter());

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 60);
    billingRepo.subscriptions.set(testCoachingId, {
      id: 'sub-1',
      coachingId: testCoachingId,
      planId: `plan-${PlanCode.ENTERPRISE}`,
      status: SubscriptionStatus.TRIALING,
      trialStartsAt: new Date(),
      trialEndsAt,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt,
      isActive: true,
      plan: billingRepo.plans.get(PlanCode.ENTERPRISE),
    });
  });

  describe('getCurrentSubscription and getPlans', () => {
    it('retrieves active subscription with AI credit balance', async () => {
      const sub = await billingService.getCurrentSubscription(testCoachingId);
      expect(sub.coachingId).toBe(testCoachingId);
      expect(sub.status).toBe(SubscriptionStatus.TRIALING);
      expect(sub.aiCreditBalance).toBe(0);
    });

    it('returns all available plans', async () => {
      const plans = await billingService.getPlans();
      expect(plans.map((p) => p.code)).toEqual(expect.arrayContaining([PlanCode.PRO_AI, PlanCode.STARTER]));
    });
  });

  describe('createOrder (prices are computed on the server)', () => {
    it('prices a plan upgrade from the plan and billing cycle', async () => {
      const monthly = await billingService.createOrder(
        { type: 'PLAN_UPGRADE', planCode: PlanCode.PRO_AI, billingCycle: 'MONTHLY' },
        testCoachingId,
        testUserId,
      );
      expect(monthly.amount).toBe(1999);

      const yearly = await billingService.createOrder(
        { type: 'PLAN_UPGRADE', planCode: PlanCode.PRO_AI, billingCycle: 'YEARLY' },
        testCoachingId,
      );
      expect(yearly.amount).toBe(19990);

      const recorded = billingRepo.payments.get(monthly.orderId);
      expect(recorded).toMatchObject({ type: 'PLAN_UPGRADE', amountPaise: 199900, status: 'CREATED', createdBy: testUserId });
    });

    it('prices AI credits from the configured per-credit price (default Rs 1)', async () => {
      const order = await billingService.createOrder({ type: 'AI_CREDITS', credits: 250 }, testCoachingId);
      expect(order.amount).toBe(250);
      expect(billingRepo.payments.get(order.orderId)?.amountPaise).toBe(25000);
    });

    it('refuses to sell a free plan and unknown plans', async () => {
      await expect(
        billingService.createOrder({ type: 'PLAN_UPGRADE', planCode: PlanCode.ENTERPRISE, billingCycle: 'MONTHLY' }, testCoachingId),
      ).rejects.toMatchObject({ code: 'PLAN_NOT_PURCHASABLE' });
      await expect(
        billingService.createOrder({ type: 'PLAN_UPGRADE', planCode: 'NOPE' as PlanCode, billingCycle: 'MONTHLY' }, testCoachingId),
      ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });

    it('ignores any amount a client tries to send', async () => {
      const order = await billingService.createOrder(
        { type: 'PLAN_UPGRADE', planCode: PlanCode.PRO_AI, billingCycle: 'MONTHLY', amount: 1 } as any,
        testCoachingId,
      );
      expect(order.amount).toBe(1999);
    });

    it('grants nothing when an order is only created', async () => {
      await billingService.createOrder({ type: 'AI_CREDITS', credits: 500 }, testCoachingId);
      expect((await billingRepo.getCreditWallet(testCoachingId)).balance).toBe(0);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('SubscriptionExpirationScheduler', () => {
    it('expires a trial whose end date has passed', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      Object.assign(billingRepo.subscriptions.get(testCoachingId), { trialEndsAt: pastDate, currentPeriodEnd: pastDate });

      const scheduler = new SubscriptionExpirationScheduler(billingRepo, mockEventBus);
      expect(await scheduler.runDailyExpirationCheck()).toBe(1);
      expect((await billingRepo.findCurrentSubscription(testCoachingId)).status).toBe(SubscriptionStatus.EXPIRED);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: BILLING_EVENTS.SUBSCRIPTION_EXPIRING,
          payload: expect.objectContaining({ coachingId: testCoachingId, daysRemaining: 0 }),
        }),
      );
    });

    it('does not expire a paid plan whose old trial date is in the past (regression)', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      Object.assign(billingRepo.subscriptions.get(testCoachingId), {
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: lastMonth,
        currentPeriodEnd: nextMonth,
      });

      const scheduler = new SubscriptionExpirationScheduler(billingRepo, mockEventBus);
      await scheduler.runDailyExpirationCheck();
      expect((await billingRepo.findCurrentSubscription(testCoachingId)).status).toBe(SubscriptionStatus.ACTIVE);
    });
  });
});
