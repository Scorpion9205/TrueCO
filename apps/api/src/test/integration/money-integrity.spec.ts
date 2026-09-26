import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PaymentMethod } from '@vargly/types';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { createTenantPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { PrismaFeeRepository } from '../../modules/fees/fee.repository.js';
import { PrismaBillingRepository } from '../../modules/billing/billing.repository.js';
import { PrismaSalaryRepository } from '../../modules/salary/salary.repository.js';
import { PrismaAiRepository } from '../../modules/ai/ai.repository.js';
import { financialYearLabel } from '../../common/money/document-number.js';

/**
 * Phase 3 gate: money is recorded exactly once, with exact totals, under concurrency and
 * webhook replays, against a real PostgreSQL database (row locks, unique constraints, counters).
 */
const APP_URL = process.env.TEST_DATABASE_URL;
const OWNER_URL = process.env.TEST_DATABASE_OWNER_URL;

const X = 'dddddddd-0000-4000-8000-000000000001';
const Y = 'eeeeeeee-0000-4000-8000-000000000002';
const STUDENT_X = 'dddddddd-1111-4000-8000-000000000001';
const STUDENT_Y = 'eeeeeeee-1111-4000-8000-000000000002';
const PLAN_X = 'dddddddd-2222-4000-8000-000000000001';
const PLAN_Y = 'eeeeeeee-2222-4000-8000-000000000002';
const INST_X = 'dddddddd-3333-4000-8000-000000000001';
const INST_X_SMALL = 'dddddddd-3333-4000-8000-000000000002';
const INST_Y = 'eeeeeeee-3333-4000-8000-000000000003';
const USER_X = 'dddddddd-4444-4000-8000-000000000001';
const TEACHER_X = 'dddddddd-5555-4000-8000-000000000001';

const asX = <T>(fn: () => T) => RequestContextService.runForTenant(X, fn);
const asY = <T>(fn: () => T) => RequestContextService.runForTenant(Y, fn);
const FY = financialYearLabel(new Date());

describe.skipIf(!APP_URL || !OWNER_URL)('Money integrity (real PostgreSQL)', () => {
  let owner: PrismaClient;
  let appBase: PrismaClient;
  let db: ExtendedPrismaClient;
  let fees: PrismaFeeRepository;

  const pay = (installmentId: string, amount: number | string, transactionRef?: string) =>
    fees.recordPaymentTransaction({
      coachingId: X,
      installmentId,
      amount,
      paymentMethod: PaymentMethod.CASH,
      transactionRef,
    });

  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } });
    appBase = new PrismaClient({ datasources: { db: { url: APP_URL } } });
    db = createTenantPrismaClient(appBase);
    fees = new PrismaFeeRepository(db);
  });

  beforeEach(async () => {
    await owner.$transaction([
      owner.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`,
      owner.$executeRawUnsafe('TRUNCATE coachings, document_sequences CASCADE'),
      owner.coaching.createMany({
        data: [
          { id: X, name: 'Xenon Classes', code: 'xenon', phone: '1', email: 'x@x.in' },
          { id: Y, name: 'Yellow Academy', code: 'yellow', phone: '2', email: 'y@y.in' },
        ],
      }),
      owner.student.createMany({
        data: [
          { id: STUDENT_X, coachingId: X, firstName: 'Xavi', lastName: 'X' },
          { id: STUDENT_Y, coachingId: Y, firstName: 'Yash', lastName: 'Y' },
        ],
      }),
      owner.feePlan.createMany({
        data: [
          { id: PLAN_X, coachingId: X, studentId: STUDENT_X, totalAmount: 5000.3, finalAmount: 5000.3, academicYear: '2026' },
          { id: PLAN_Y, coachingId: Y, studentId: STUDENT_Y, totalAmount: 100, finalAmount: 100, academicYear: '2026' },
        ],
      }),
      owner.feeInstallment.createMany({
        data: [
          { id: INST_X, coachingId: X, feePlanId: PLAN_X, installmentNo: 1, amount: 5000, dueDate: new Date() },
          { id: INST_X_SMALL, coachingId: X, feePlanId: PLAN_X, installmentNo: 2, amount: 0.3, dueDate: new Date() },
          { id: INST_Y, coachingId: Y, feePlanId: PLAN_Y, installmentNo: 1, amount: 100, dueDate: new Date() },
        ],
      }),
      owner.user.create({
        data: { id: USER_X, coachingId: X, name: 'T', email: 't@x.in', phone: '1', passwordHash: 'x' },
      }),
      owner.teacher.create({
        data: { id: TEACHER_X, coachingId: X, userId: USER_X, name: 'T', phone: '1', email: 't@x.in' },
      }),
    ]);
  });

  afterAll(async () => {
    await owner?.$disconnect();
    await appBase?.$disconnect();
  });

  describe('fee payments', () => {
    it('never overpays under 10 concurrent payments, and totals stay exact', async () => {
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => asX(() => pay(INST_X, 1000))));

      const recorded = results.filter((r) => r.status === 'fulfilled' && (r.value as any).kind === 'recorded');
      expect(recorded).toHaveLength(5);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(5);

      const installment = await asX(() => (db as any).feeInstallment.findUnique({ where: { id: INST_X } }));
      expect(installment.paidAmount.toString()).toBe('5000');
      expect(installment.status).toBe('PAID');
    });

    it('issues gap-free receipt numbers per coaching, even concurrently', async () => {
      await Promise.all(Array.from({ length: 5 }, () => asX(() => pay(INST_X, 100))));
      await asY(() =>
        fees.recordPaymentTransaction({ coachingId: Y, installmentId: INST_Y, amount: 10, paymentMethod: PaymentMethod.UPI }),
      );

      const receiptsX = (await asX(() => (db as any).feeTransaction.findMany())).map((t: any) => t.receiptNumber).sort();
      expect(receiptsX).toEqual([1, 2, 3, 4, 5].map((n) => `RCT/${FY}/${String(n).padStart(5, '0')}`));

      const receiptsY = (await asY(() => (db as any).feeTransaction.findMany())).map((t: any) => t.receiptNumber);
      expect(receiptsY).toEqual([`RCT/${FY}/00001`]);
    });

    it('records a gateway payment once however many times its webhook is delivered', async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => asX(() => pay(INST_X, 250, 'pay_replayed_1'))));

      expect(results.filter((r) => r.kind === 'recorded')).toHaveLength(1);
      expect(results.filter((r) => r.kind === 'duplicate')).toHaveLength(5);
      const installment = await asX(() => (db as any).feeInstallment.findUnique({ where: { id: INST_X } }));
      expect(installment.paidAmount.toString()).toBe('250');
    });

    it('adds paise exactly (0.1 + 0.2 settles a 0.30 installment)', async () => {
      await asX(() => pay(INST_X_SMALL, 0.1));
      const second = await asX(() => pay(INST_X_SMALL, 0.2));

      expect(second.kind === 'recorded' && second.remainingBalance.toString()).toBe('0');
      const installment = await asX(() => (db as any).feeInstallment.findUnique({ where: { id: INST_X_SMALL } }));
      expect(installment.status).toBe('PAID');
    });

    it('lets a waiver and a completing payment race without both succeeding', async () => {
      const [payment, waiver] = await Promise.allSettled([
        asX(() => pay(INST_X, 5000)),
        asX(() => fees.waiveInstallment(INST_X, 'hardship')),
      ]);
      const installment = await asX(() => (db as any).feeInstallment.findUnique({ where: { id: INST_X } }));

      if (installment.status === 'PAID') {
        expect(payment.status).toBe('fulfilled');
        expect(waiver.status === 'fulfilled' && waiver.value).toBeNull();
      } else {
        expect(installment.status).toBe('WAIVED');
        expect(payment.status).toBe('rejected');
      }
    });
  });

  describe('Vargly billing orders', () => {
    it('settles a paid order exactly once under concurrent webhook deliveries', async () => {
      const billing = new PrismaBillingRepository(db);
      await asX(() =>
        billing.createPaymentRecord({ coachingId: X, type: 'AI_CREDITS', credits: 400, amountPaise: 40000, gatewayOrderId: 'order_x1' }),
      );

      const settle = () =>
        asX(() =>
          billing.settlePayment({ gatewayOrderId: 'order_x1', gatewayPaymentId: 'pay_x1', amountPaidPaise: 40000, paidAt: new Date() }),
        );
      const results = await Promise.all(Array.from({ length: 6 }, settle));

      expect(results.filter((r) => r.kind === 'settled')).toHaveLength(1);
      expect(results.filter((r) => r.kind === 'duplicate')).toHaveLength(5);
      const wallet = await asX(() => (db as any).aiCreditWallet.findUnique({ where: { coachingId: X } }));
      expect(wallet.balance).toBe(400);
      const payment = await asX(() => (db as any).billingPayment.findUnique({ where: { gatewayOrderId: 'order_x1' } }));
      expect(payment.invoiceNumber).toMatch(new RegExp(`^INV/${FY}/\\d{5}$`));
    });

    it('does not settle a payment for the wrong amount', async () => {
      const billing = new PrismaBillingRepository(db);
      await asX(() =>
        billing.createPaymentRecord({ coachingId: X, type: 'AI_CREDITS', credits: 400, amountPaise: 40000, gatewayOrderId: 'order_x2' }),
      );
      const result = await asX(() =>
        billing.settlePayment({ gatewayOrderId: 'order_x2', gatewayPaymentId: 'pay_x2', amountPaidPaise: 100, paidAt: new Date() }),
      );
      expect(result.kind).toBe('amount_mismatch');
      expect(await asX(() => (db as any).aiCreditWallet.findUnique({ where: { coachingId: X } }))).toBeNull();
    });
  });

  describe('salaries', () => {
    it('allows one salary per teacher per month, and pays it once', async () => {
      const salaries = new PrismaSalaryRepository(db);
      const input = { coachingId: X, teacherId: TEACHER_X, amount: 20000, month: 9, year: 2026 };
      const salary = await asX(() => salaries.create(input));
      await expect(asX(() => salaries.create(input))).rejects.toMatchObject({ code: 'P2002' });

      const payments = await Promise.all(
        Array.from({ length: 4 }, () => asX(() => salaries.recordPayment(salary.id, { paymentMethod: PaymentMethod.BANK_TRANSFER }))),
      );
      expect(payments.filter((p) => p !== null)).toHaveLength(1);
    });
  });

  describe('AI credits', () => {
    it('never lets concurrent reservations take the balance below zero', async () => {
      const ai = new PrismaAiRepository(db);
      const wallet = await asX(() => ai.createOrGetWallet(X, 3));

      const reservations = await Promise.all(Array.from({ length: 8 }, () => asX(() => ai.reserveCredits(wallet.id, 1))));
      expect(reservations.filter((r) => r !== null)).toHaveLength(3);

      const after = await asX(() => (db as any).aiCreditWallet.findUnique({ where: { id: wallet.id } }));
      expect(after.balance).toBe(0);
    });
  });
});
