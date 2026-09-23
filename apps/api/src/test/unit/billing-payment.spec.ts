import { describe, it, expect, beforeEach } from 'vitest';
import { BillingService } from '../../modules/billing/billing.service.js';
import { FeeService } from '../../modules/fees/fee.service.js';
import { InMemoryBillingRepository } from '../fakes/in-memory-billing.repository.js';
import {
  IFeeRepository,
  CreateFeePlanInput,
  RecordPaymentResult,
  RecordPaymentTxInput,
} from '../../modules/fees/fee.repository.js';
import { money } from '../../common/money/money.js';
import { MockPaymentGatewayAdapter } from '../../modules/billing/adapters/mock-payment-gateway.adapter.js';
import { EventBus } from '../../events/event-bus.js';
import { DiscountType, FeeInstallmentStatus, PlanCode, SubscriptionStatus } from '@trueco/types';

class FakeFeeRepository implements IFeeRepository {
  public plans: Map<string, any> = new Map();
  public installments: Map<string, any> = new Map();
  public transactions: Map<string, any> = new Map();
  private receiptCounter = 0;

  public async createFeePlan(input: CreateFeePlanInput): Promise<any> {
    const planId = `plan-${Date.now()}`;
    const installments = input.installments.map((inst) => {
      const instId = crypto.randomUUID();
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

  public async listCoachingsForReminders(): Promise<Array<{ id: string; timezone: string | null }>> {
    return [];
  }

  public async findInstallmentsDueBetween(): Promise<any[]> {
    return [];
  }

  public async recordPaymentTransaction(input: RecordPaymentTxInput): Promise<RecordPaymentResult> {
    const inst = this.installments.get(input.installmentId);
    if (!inst) throw new Error('Not found');
    const existing = [...this.transactions.values()].find(
      (t) => input.transactionRef && t.transactionRef === input.transactionRef,
    );
    if (existing) return { kind: 'duplicate', transaction: existing };

    const paid = money(inst.paidAmount).plus(input.amount);
    inst.paidAmount = paid.toNumber();
    inst.status = paid.greaterThanOrEqualTo(inst.amount) ? FeeInstallmentStatus.PAID : FeeInstallmentStatus.PARTIAL;

    this.receiptCounter++;
    const tx = {
      id: `tx-${this.receiptCounter}`,
      installmentId: input.installmentId,
      amount: money(input.amount).toNumber(),
      receiptNumber: `RCT/2026-27/${String(this.receiptCounter).padStart(5, '0')}`,
      paymentMethod: input.paymentMethod,
      transactionRef: input.transactionRef,
      paidAt: new Date(),
    };
    this.transactions.set(tx.id, tx);

    return {
      kind: 'recorded',
      transaction: tx,
      installment: inst,
      plan: this.plans.get(inst.feePlanId),
      remainingBalance: money(inst.amount).minus(paid),
    };
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
  let billingRepo: InMemoryBillingRepository;
  let feeRepo: FakeFeeRepository;
  let eventBus: EventBus;
  let paymentAdapter: MockPaymentGatewayAdapter;
  let billingService: BillingService;
  let feeService: FeeService;

  const coachingId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    billingRepo = new InMemoryBillingRepository();
    feeRepo = new FakeFeeRepository();
    eventBus = new EventBus();
    paymentAdapter = new MockPaymentGatewayAdapter();

    billingService = new BillingService(billingRepo, eventBus, paymentAdapter);
    feeService = new FeeService(feeRepo, eventBus, paymentAdapter);
  });

  describe('BillingService Payment Integration', () => {
    const paidWebhook = (orderId: string, amountPaise: number, paymentId = 'pay_test_123') => ({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: paymentId, order_id: orderId, amount: amountPaise, notes: { coachingId } },
        },
      },
    });

    it('settles a paid plan upgrade order: plan, period and plan credits', async () => {
      const order = await billingService.createOrder(
        { type: 'PLAN_UPGRADE', planCode: PlanCode.PRO_AI, billingCycle: 'MONTHLY' },
        coachingId,
      );

      const result = await billingService.handleWebhook(paidWebhook(order.orderId, 199900), 'any-signature');
      expect(result.status).toBe('PROCESSED');

      const sub = await billingRepo.findCurrentSubscription(coachingId);
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.plan.code).toBe(PlanCode.PRO_AI);
      expect((await billingRepo.getCreditWallet(coachingId)).balance).toBe(500);
      expect(billingRepo.payments.get(order.orderId)).toMatchObject({
        status: 'PAID',
        gatewayPaymentId: 'pay_test_123',
        invoiceNumber: expect.stringMatching(/^INV\/\d{4}-\d{2}\/\d{5}$/),
      });
    });

    it('applies a replayed or paired webhook only once', async () => {
      const order = await billingService.createOrder({ type: 'AI_CREDITS', credits: 300 }, coachingId);
      const webhook = paidWebhook(order.orderId, 30000);

      expect((await billingService.handleWebhook(webhook, 'any-signature')).status).toBe('PROCESSED');
      expect((await billingService.handleWebhook(webhook, 'any-signature')).status).toBe('DUPLICATE');
      const orderPaid = {
        event: 'order.paid',
        payload: { ...webhook.payload, order: { entity: { id: order.orderId, notes: { coachingId } } } },
      };
      expect((await billingService.handleWebhook(orderPaid, 'any-signature')).status).toBe('DUPLICATE');

      expect((await billingRepo.getCreditWallet(coachingId)).balance).toBe(300);
    });

    it('refuses to apply an order when the paid amount differs from its price', async () => {
      const order = await billingService.createOrder({ type: 'AI_CREDITS', credits: 1000 }, coachingId);
      const result = await billingService.handleWebhook(paidWebhook(order.orderId, 100), 'any-signature');

      expect(result.status).toBe('REJECTED');
      expect((await billingRepo.getCreditWallet(coachingId)).balance).toBe(0);
    });

    it('grants nothing for a signed payment that has no matching order (no more notes-driven upgrades)', async () => {
      const forged = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_x',
              order_id: 'order_never_created',
              amount: 100,
              notes: { coachingId, type: 'PLAN_UPGRADE', planCode: PlanCode.PRO_AI, billingCycle: 'YEARLY' },
            },
          },
        },
      };
      expect((await billingService.handleWebhook(forged, 'any-signature')).status).toBe('IGNORED');
      expect(await billingRepo.findCurrentSubscription(coachingId)).toBeNull();
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

      // Gateway retry and the paired payment_link.paid event carry the same payment id
      const retry = await feeService.handlePaymentWebhook(webhookPayload, 'signature');
      const paired = await feeService.handlePaymentWebhook({ ...webhookPayload, event: 'payment_link.paid' }, 'signature');
      expect([retry.status, paired.status]).toEqual(['DUPLICATE', 'DUPLICATE']);
      expect(feeRepo.transactions.size).toBe(1);
    });
  });
});
