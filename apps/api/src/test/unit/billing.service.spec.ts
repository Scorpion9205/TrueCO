import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingService } from '../../modules/billing/billing.service.js';
import { IBillingRepository } from '../../modules/billing/billing.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { PlanCode, SubscriptionStatus } from '@trueco/types';
import { BILLING_EVENTS } from '../../modules/billing/billing.events.js';
import { SubscriptionExpirationScheduler } from '../../modules/billing/billing.cron.js';

class InMemoryBillingRepository implements IBillingRepository {
  public subscriptions: Map<string, any> = new Map();
  public plans: Map<string, any> = new Map();
  public wallets: Map<string, any> = new Map();

  public constructor() {
    // Seed default plans
    this.plans.set(PlanCode.STARTER, {
      id: 'plan-starter',
      code: PlanCode.STARTER,
      name: 'Starter',
      priceMonthly: 0,
      priceYearly: 0,
      defaultFeatures: ['attendance', 'students'],
      defaultCredits: 0,
      isActive: true,
    });

    this.plans.set(PlanCode.PRO_AI, {
      id: 'plan-pro-ai',
      code: PlanCode.PRO_AI,
      name: 'Pro AI',
      priceMonthly: 1999,
      priceYearly: 19990,
      defaultFeatures: ['attendance', 'students', 'fees', 'whatsapp'],
      defaultCredits: 100,
      isActive: true,
    });

    this.plans.set(PlanCode.ENTERPRISE, {
      id: 'plan-enterprise',
      code: PlanCode.ENTERPRISE,
      name: 'Enterprise',
      priceMonthly: 4999,
      priceYearly: 49990,
      defaultFeatures: ['*'],
      defaultCredits: 500,
      isActive: true,
    });
  }

  public async findCurrentSubscription(coachingId: string): Promise<any | null> {
    return this.subscriptions.get(coachingId) || null;
  }

  public async findPlanByCode(code: PlanCode): Promise<any | null> {
    return this.plans.get(code) || null;
  }

  public async findAllActivePlans(): Promise<any[]> {
    return Array.from(this.plans.values()).filter((p) => p.isActive);
  }

  public async updateSubscriptionPlan(
    coachingId: string,
    planId: string,
    status: SubscriptionStatus,
    currentPeriodEnd: Date,
  ): Promise<any> {
    const existing = this.subscriptions.get(coachingId);
    const plan = Array.from(this.plans.values()).find((p) => p.id === planId);
    const updated = {
      ...(existing || { id: `sub-${crypto.randomUUID()}`, coachingId, isActive: true }),
      planId,
      status,
      currentPeriodEnd,
      plan,
    };
    this.subscriptions.set(coachingId, updated);
    return updated;
  }

  public async findExpiringSubscriptions(threshold: Date): Promise<any[]> {
    return Array.from(this.subscriptions.values()).filter(
      (s) => s.isActive && new Date(s.trialEndsAt) <= threshold,
    );
  }

  public async updateSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<any> {
    for (const [key, sub] of this.subscriptions.entries()) {
      if (sub.id === id) {
        sub.status = status;
        this.subscriptions.set(key, sub);
        return sub;
      }
    }
    return null;
  }

  public async getCreditWallet(coachingId: string): Promise<any | null> {
    return (
      this.wallets.get(coachingId) || {
        id: `wallet-${coachingId}`,
        coachingId,
        balance: 0,
        totalAllocated: 0,
      }
    );
  }

  public async addCredits(coachingId: string, credits: number): Promise<any> {
    const current = await this.getCreditWallet(coachingId);
    const updated = {
      ...current,
      balance: current.balance + credits,
      totalAllocated: current.totalAllocated + credits,
    };
    this.wallets.set(coachingId, updated);
    return updated;
  }
}

describe('BillingService & Subscription Lifecycle (Phase 4 Unit Tests)', () => {
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
    billingService = new BillingService(billingRepo, mockEventBus);

    // Initial subscription: 60-day trial on Starter plan
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 60);

    billingRepo.subscriptions.set(testCoachingId, {
      id: 'sub-1',
      coachingId: testCoachingId,
      planId: 'plan-starter',
      status: SubscriptionStatus.TRIALING,
      trialStartsAt: new Date(),
      trialEndsAt,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt,
      isActive: true,
      plan: billingRepo.plans.get(PlanCode.STARTER),
    });
  });

  describe('getCurrentSubscription and getPlans', () => {
    it('retrieves active subscription with AI credit balance', async () => {
      const sub = await billingService.getCurrentSubscription(testCoachingId);

      expect(sub.coachingId).toBe(testCoachingId);
      expect(sub.status).toBe(SubscriptionStatus.TRIALING);
      expect(sub.planCode).toBe(PlanCode.STARTER);
      expect(sub.aiCreditBalance).toBe(0);
    });

    it('returns all available plans', async () => {
      const plans = await billingService.getPlans();
      expect(plans.length).toBe(3);
      expect(plans.map((p) => p.code)).toContain(PlanCode.PRO_AI);
    });
  });

  describe('upgradePlan', () => {
    it('upgrades subscription to PRO_AI with monthly billing and adds default credits', async () => {
      const upgraded = await billingService.upgradePlan(
        {
          planCode: PlanCode.PRO_AI,
          billingCycle: 'MONTHLY',
        },
        testCoachingId,
        testUserId,
      );

      expect(upgraded.status).toBe(SubscriptionStatus.ACTIVE);
      expect(upgraded.planCode).toBe(PlanCode.PRO_AI);
      expect(upgraded.aiCreditBalance).toBe(100); // 100 default credits for PRO_AI

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: BILLING_EVENTS.SUBSCRIPTION_UPGRADED,
          payload: expect.objectContaining({
            coachingId: testCoachingId,
            newPlan: PlanCode.PRO_AI,
            status: SubscriptionStatus.ACTIVE,
          }),
        }),
      );
    });

    it('throws PLAN_NOT_FOUND when attempting to upgrade to non-existent plan', async () => {
      await expect(
        billingService.upgradePlan(
          {
            planCode: 'INVALID_PLAN' as any,
            billingCycle: 'MONTHLY',
          },
          testCoachingId,
          testUserId,
        ),
      ).rejects.toThrow(AppError);
    });
  });

  describe('purchaseCredits', () => {
    it('adds credits to wallet and emits AiCreditsPurchased event', async () => {
      const result = await billingService.purchaseCredits(
        { credits: 250 },
        testCoachingId,
        testUserId,
      );

      expect(result.newBalance).toBe(250);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: BILLING_EVENTS.AI_CREDITS_PURCHASED,
          payload: expect.objectContaining({
            coachingId: testCoachingId,
            creditsAdded: 250,
            newBalance: 250,
          }),
        }),
      );
    });
  });

  describe('SubscriptionExpirationScheduler', () => {
    it('detects expiring trial and updates status to EXPIRED when daysRemaining <= 0', async () => {
      // Set trial to expired yesterday
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      billingRepo.subscriptions.set(testCoachingId, {
        id: 'sub-1',
        coachingId: testCoachingId,
        planId: 'plan-starter',
        status: SubscriptionStatus.TRIALING,
        trialStartsAt: new Date(),
        trialEndsAt: pastDate,
        isActive: true,
        plan: billingRepo.plans.get(PlanCode.STARTER),
      });

      const scheduler = new SubscriptionExpirationScheduler(billingRepo, mockEventBus);
      const processed = await scheduler.runDailyExpirationCheck();

      expect(processed).toBe(1);
      const updatedSub = await billingRepo.findCurrentSubscription(testCoachingId);
      expect(updatedSub.status).toBe(SubscriptionStatus.EXPIRED);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: BILLING_EVENTS.SUBSCRIPTION_EXPIRING,
          payload: expect.objectContaining({
            coachingId: testCoachingId,
            daysRemaining: 0,
          }),
        }),
      );
    });
  });
});
