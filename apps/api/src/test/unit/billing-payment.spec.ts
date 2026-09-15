import { describe, it, expect, beforeEach } from 'vitest';
import { BillingService } from '../../modules/billing/billing.service.js';
import { FeeService } from '../../modules/fees/fee.service.js';
import { IBillingRepository } from '../../modules/billing/billing.repository.js';
import { IFeeRepository, CreateFeePlanInput, RecordPaymentTxInput } from '../../modules/fees/fee.repository.js';
import { MockPaymentGatewayAdapter } from '../../modules/billing/adapters/mock-payment-gateway.adapter.js';
import { EventBus } from '../../events/event-bus.js';
import { DiscountType, FeeInstallmentStatus, SubscriptionStatus } from '@trueco/types';

class FakeBillingRepository implements IBillingRepository {
  public subscriptions: Map<string, any> = new Map();
  public plans: Map<string, any> = new Map();
  public wallets: Map<string, any> = new Map();

  public constructor() {
    this.plans.set('GROWTH', {
      id: 'plan-growth',
      code: 'GROWTH',
      name: 'Growth Plan',
      priceMonthly: 1999,
      priceYearly: 19990,
      defaultFeatures: ['*'],
      defaultCredits: 100,
      isActive: true,
    });
  }

  public async findCurrentSubscription(coachingId: string): Promise<any> {
    return this.subscriptions.get(coachingId) || null;
  }

  public async findPlanByCode(code: string): Promise<any> {
    return this.plans.get(code) || null;
  }

  public async updateSubscriptionPlan(coachingId: string, planId: string, status: SubscriptionStatus, periodEnd: Date): Promise<any> {
    const updated = {
      id: 'sub-1',
      coachingId,
      planId,
      status,
      currentPeriodEnd: periodEnd,
      isActive: true,
      plan: this.plans.get('GROWTH'),
    };
    this.subscriptions.set(coachingId, updated);
    return updated;
  }

  public async updateSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<any> {
    for (const [coachingId, sub] of this.subscriptions.entries()) {
      if (sub.id === id) {
        sub.status = status;
        this.subscriptions.set(coachingId, sub);
        return sub;
      }
    }
    return null;
  }

  public async getCreditWallet(coachingId: string): Promise<any> {
    if (!this.wallets.has(coachingId)) {
      this.wallets.set(coachingId, { id: 'w-1', coachingId, balance: 0, totalAllocated: 0, totalConsumed: 0 });
    }
    return this.wallets.get(coachingId);
  }

  public async addCredits(coachingId: string, amount: number): Promise<any> {
    const w = await this.getCreditWallet(coachingId);
    w.balance += amount;
    return w;
  }

  public async findAllActivePlans(): Promise<any[]> {
    return Array.from(this.plans.values());
  }

  public async createTrialSubscription(): Promise<any> { return null; }
  public async findExpiringSubscriptions(): Promise<any[]> { return []; }
  public async markSubscriptionExpired(): Promise<any> { return null; }
}

class FakeFeeRepository implements IFeeRepository {
  public plans: Map<string, any> = new Map();
  public installments: Map<string, any> = new Map();
  public transactions: Map<string, any> = new Map();
  private receiptCounter = 1000;

  public async createFeePlan(input: CreateFeePlanInput): Promise<any> {
    const planId = `plan-${Date.now()}`;
    const installments = input.installments.map((inst, idx) => {
      const instId = `inst-${planId}-${idx + 1}`;
      const record = {
        id: instId,
        coachingId: input.coachingId,
        feePlanId: planId,
        installmentNo: inst.installmentNo,
        amount: inst.amount,
        dueDate: inst.dueDate,
        status: FeeInstallmentStatus.PENDING,
        paidAmount: 0,
        paidAt: null,
        feePlan: { studentId: input.studentId },
      };
      this.installments.set(instId, record);
      return record;
    });

    const plan = {
      id: planId,
      coachingId: input.coachingId,
      studentId: input.studentId,
      totalAmount: input.totalAmount,
      discountType: input.discountType,
      discountValue: input.discountValue,
      finalAmount: input.totalAmount,
      status: 'ACTIVE',
      installments,
    };
    this.plans.set(planId, plan);
    return plan;
  }

  public async findInstallmentById(id: string): Promise<any> {
    return this.installments.get(id) || null;
  }

  public async recordPaymentTransaction(input: RecordPaymentTxInput): Promise<any> {
    const inst = this.installments.get(input.installmentId);
    if (!inst) throw new Error('Not found');

    inst.paidAmount = Number(inst.paidAmount || 0) + input.amount;
    if (inst.paidAmount >= Number(inst.amount)) {
      inst.status = FeeInstallmentStatus.PAID;
    } else {
      inst.status = FeeInstallmentStatus.PARTIAL;
    }

    const tx = {
      id: `tx-${Date.now()}`,
      installmentId: input.installmentId,
      amount: input.amount,
      receiptNumber: input.receiptNumber,
      paymentMethod: input.paymentMethod,
      transactionRef: input.transactionRef,
      paidAt: new Date(),
    };
    this.transactions.set(tx.id, tx);

    return { transaction: tx, installment: inst, plan: this.plans.get(inst.feePlanId) };
  }

  public async generateReceiptNumber(coachingId: string): Promise<string> {
    this.receiptCounter++;
    return `REC-${coachingId.slice(0, 4)}-${this.receiptCounter}`;
  }

  public async waiveInstallment(id: string): Promise<any> {
    const inst = this.installments.get(id);
    if (inst) inst.status = FeeInstallmentStatus.WAIVED;
    return inst;
  }

  public async findPlansByStudent(): Promise<any[]> { return []; }
  public async findPlanById(): Promise<any> { return null; }
  public async findPendingInstallments(): Promise<any[]> { return []; }
}

describe('Payment Gateway & Webhook Lifecycle', () => {
  let billingRepo: FakeBillingRepository;
  let feeRepo: FakeFeeRepository;
  let eventBus: EventBus;
  let paymentAdapter: MockPaymentGatewayAdapter;
  let billingService: BillingService;
  let feeService: FeeService;

  const coachingId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    billingRepo = new FakeBillingRepository();
    feeRepo = new FakeFeeRepository();
    eventBus = new EventBus();
    paymentAdapter = new MockPaymentGatewayAdapter();

    billingService = new BillingService(billingRepo, eventBus, paymentAdapter);
    feeService = new FeeService(feeRepo, eventBus, paymentAdapter);
  });

  describe('BillingService Payment Integration', () => {
    it('creates a checkout order for plan upgrade', async () => {
      const order = await billingService.createOrder(
        {
          type: 'PLAN_UPGRADE',
          planCode: 'GROWTH',
          billingCycle: 'ANNUAL',
          amount: 19999,
        },
        coachingId,
      );

      expect(order.orderId).toBeDefined();
      expect(order.amount).toBe(19999);
      expect(order.currency).toBe('INR');
      expect(order.receipt).toContain('sub_');
    });

    it('processes a valid payment webhook for plan upgrade', async () => {
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
              amount: 1999900,
              notes: {
                coachingId,
                type: 'PLAN_UPGRADE',
                planCode: 'GROWTH',
                billingCycle: 'MONTHLY',
              },
            },
          },
        },
      };

      const result = await billingService.handleWebhook(payload, 'any-signature');
      expect(result.status).toBe('PROCESSED');

      const currentSub = await billingService.getCurrentSubscription(coachingId);
      expect(currentSub.planCode).toBe('GROWTH');
    });

    it('processes a valid payment webhook for AI credits purchase', async () => {
      const payload = {
        event: 'order.paid',
        payload: {
          order: {
            entity: {
              id: 'order_test_456',
              notes: {
                coachingId,
                type: 'AI_CREDITS',
                credits: '500',
              },
            },
          },
        },
      };

      const result = await billingService.handleWebhook(payload, 'any-signature');
      expect(result.status).toBe('PROCESSED');

      const wallet = await billingRepo.getCreditWallet(coachingId);
      expect(wallet?.balance).toBe(500);
    });
  });

  describe('FeeService Payment Integration', () => {
    it('generates a payment link for a pending fee installment', async () => {
      const plan = await feeService.createFeePlan(
        {
          studentId: 'student-1',
          academicYear: '2026-2027',
          totalAmount: 10000,
          discountType: DiscountType.FIXED,
          discountValue: 1000,
          installments: [
            {
              installmentNo: 1,
              amount: 9000,
              dueDate: '2026-10-15',
            },
          ],
        },
        coachingId,
      );

      const installmentId = plan.installments![0].id;
      const link = await feeService.createPaymentLink(installmentId, coachingId);

      expect(link.paymentLinkId).toBeDefined();
      expect(link.shortUrl).toContain('/pay/');
      expect(link.amount).toBe(9000);
    });

    it('processes a fee payment webhook and marks installment as paid', async () => {
      const plan = await feeService.createFeePlan(
        {
          studentId: 'student-2',
          academicYear: '2026-2027',
          totalAmount: 5000,
          installments: [
            {
              installmentNo: 1,
              amount: 5000,
              dueDate: '2026-10-15',
            },
          ],
        },
        coachingId,
      );

      const installmentId = plan.installments![0].id;

      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_online_999',
              amount: 500000, // in paise
              notes: {
                coachingId,
                installmentId,
              },
            },
          },
        },
      };

      const result = await feeService.handlePaymentWebhook(webhookPayload, 'signature');
      expect(result.status).toBe('PROCESSED');

      const updatedInstallment = await feeRepo.findInstallmentById(installmentId);
      expect(updatedInstallment?.status).toBe(FeeInstallmentStatus.PAID);
      expect(Number(updatedInstallment?.paidAmount)).toBe(5000);
    });
  });
});
