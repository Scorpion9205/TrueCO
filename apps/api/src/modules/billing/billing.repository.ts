import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { PlanCode, SubscriptionStatus } from '@trueco/types';

export interface IBillingRepository {
  findCurrentSubscription(coachingId: string): Promise<any | null>;
  findPlanByCode(code: PlanCode): Promise<any | null>;
  findAllActivePlans(): Promise<any[]>;
  updateSubscriptionPlan(
    coachingId: string,
    planId: string,
    status: SubscriptionStatus,
    currentPeriodEnd: Date,
  ): Promise<any>;
  findExpiringSubscriptions(threshold: Date): Promise<any[]>;
  updateSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<any>;
  getCreditWallet(coachingId: string): Promise<any | null>;
  addCredits(coachingId: string, credits: number): Promise<any>;
}

export class PrismaBillingRepository implements IBillingRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async findCurrentSubscription(coachingId: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.subscription.findFirst({
      where: { coachingId, isActive: true },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findPlanByCode(code: PlanCode): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.plan.findUnique({
      where: { code },
    });
  }

  public async findAllActivePlans(): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  public async updateSubscriptionPlan(
    coachingId: string,
    planId: string,
    status: SubscriptionStatus,
    currentPeriodEnd: Date,
  ): Promise<any> {
    const rawPrisma = this.prisma as any;

    const currentSub = await rawPrisma.subscription.findFirst({
      where: { coachingId, isActive: true },
    });

    if (currentSub) {
      return rawPrisma.subscription.update({
        where: { id: currentSub.id },
        data: {
          planId,
          status,
          currentPeriodEnd,
        },
        include: { plan: true },
      });
    }

    return null;
  }

  public async findExpiringSubscriptions(threshold: Date): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.subscription.findMany({
      where: {
        isActive: true,
        status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE] },
        trialEndsAt: { lte: threshold },
      },
      include: { plan: true },
    });
  }

  public async updateSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.subscription.update({
      where: { id },
      data: { status },
      include: { plan: true },
    });
  }

  public async getCreditWallet(coachingId: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.aiCreditWallet.findUnique({
      where: { coachingId },
    });
  }

  public async addCredits(coachingId: string, credits: number): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.aiCreditWallet.upsert({
      where: { coachingId },
      create: {
        coachingId,
        balance: credits,
        totalAllocated: credits,
      },
      update: {
        balance: { increment: credits },
        totalAllocated: { increment: credits },
      },
    });
  }
}
