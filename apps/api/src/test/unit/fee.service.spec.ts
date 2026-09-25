import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeeService } from '../../modules/fees/fee.service.js';
import {
  CreateFeePlanInput,
  IFeeRepository,
  RecordPaymentResult,
  RecordPaymentTxInput,
} from '../../modules/fees/fee.repository.js';
import { money } from '../../common/money/money.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  DiscountType,
  FeeInstallmentStatus,
  PaymentMethod,
} from '@trueco/types';
import { FEE_EVENTS } from '../../modules/fees/fee.events.js';

class InMemoryFeeRepository implements IFeeRepository {
  public plans: Map<string, any> = new Map();
  public installments: Map<string, any> = new Map();
  public transactions: Map<string, any> = new Map();
  private receiptCounter = 0;

  public async createFeePlan(input: CreateFeePlanInput): Promise<any> {
    const planId = `plan-${crypto.randomUUID()}`;
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
      discountType: input.discountType || null,
      discountValue: input.discountValue || null,
      finalAmount: input.finalAmount,
      academicYear: input.academicYear,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      installments,
    };

    this.plans.set(planId, plan);
    return plan;
  }

  public async findPlanById(id: string): Promise<any | null> {
    const plan = this.plans.get(id);
    if (!plan) return null;
    const installments = Array.from(this.installments.values()).filter(
      (inst) => inst.feePlanId === id,
    );
    return { ...plan, installments };
  }

  public async findPlansByStudent(studentId: string): Promise<any[]> {
    return Array.from(this.plans.values())
      .filter((p) => p.studentId === studentId)
      .map((p) => {
        const installments = Array.from(this.installments.values()).filter(
          (inst) => inst.feePlanId === p.id,
        );
        return { ...p, installments };
      });
  }

  public async findInstallmentById(id: string): Promise<any | null> {
    return this.installments.get(id) || null;
  }

  public async findPendingInstallments(dueBeforeDate: Date): Promise<any[]> {
    return Array.from(this.installments.values()).filter(
      (inst) =>
        inst.status !== FeeInstallmentStatus.PAID &&
        inst.status !== FeeInstallmentStatus.WAIVED &&
        new Date(inst.dueDate) <= dueBeforeDate,
    );
  }

  public async listCoachingsForReminders(): Promise<Array<{ id: string; timezone: string | null }>> {
    return [];
  }

  public async findInstallmentsDueBetween(): Promise<any[]> {
    return [];
  }

  public async recordPaymentTransaction(input: RecordPaymentTxInput): Promise<RecordPaymentResult> {
    const installment = this.installments.get(input.installmentId);
    if (!installment) {
      throw new AppError('INSTALLMENT_NOT_FOUND', 'Fee installment not found', 404);
    }
    if (input.transactionRef) {
      const existing = [...this.transactions.values()].find((t) => t.transactionRef === input.transactionRef);
      if (existing) return { kind: 'duplicate', transaction: existing };
    }
    if (installment.status === FeeInstallmentStatus.PAID) {
      throw new AppError('INSTALLMENT_ALREADY_PAID', 'This installment is already fully paid', 409);
    }
    if (installment.status === FeeInstallmentStatus.WAIVED) {
      throw new AppError('INSTALLMENT_WAIVED', 'Cannot accept payment for a waived installment', 409);
    }

    const amount = money(input.amount);
    const total = money(installment.amount);
    const alreadyPaid = money(installment.paidAmount);
    if (amount.greaterThan(total.minus(alreadyPaid))) {
      throw new AppError('AMOUNT_EXCEEDS_BALANCE', 'Payment amount exceeds remaining balance', 400);
    }

    const newPaid = alreadyPaid.plus(amount);
    installment.paidAmount = newPaid.toNumber();
    installment.status = newPaid.greaterThanOrEqualTo(total) ? FeeInstallmentStatus.PAID : FeeInstallmentStatus.PARTIAL;

    this.receiptCounter++;
    const tx = {
      id: `tx-${crypto.randomUUID()}`,
      coachingId: input.coachingId,
      installmentId: input.installmentId,
      amount: amount.toNumber(),
      paymentMethod: input.paymentMethod,
      transactionRef: input.transactionRef || null,
      receiptNumber: `RCT/2026-27/${String(this.receiptCounter).padStart(5, '0')}`,
      remarks: input.remarks || null,
      createdAt: new Date(),
    };
    this.transactions.set(tx.id, tx);

    return {
      kind: 'recorded',
      transaction: tx,
      installment,
      plan: this.plans.get(installment.feePlanId),
      remainingBalance: total.minus(newPaid),
    };
  }

  public async waiveInstallment(installmentId: string, remarks?: string): Promise<any | null> {
    const installment = this.installments.get(installmentId);
    if (!installment) return null;
    if (![FeeInstallmentStatus.PENDING, FeeInstallmentStatus.PARTIAL].includes(installment.status)) return null;

    installment.status = FeeInstallmentStatus.WAIVED;
    installment.remarks = remarks;
    return { ...installment, feePlan: this.plans.get(installment.feePlanId) };
  }
}

describe('FeeService (Phase 4 Domain Unit Tests)', () => {
  let feeService: FeeService;
  let feeRepo: InMemoryFeeRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testStudentId = '22222222-2222-2222-2222-222222222222';
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    feeRepo = new InMemoryFeeRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    feeService = new FeeService(feeRepo, mockEventBus);
  });

  describe('createFeePlan', () => {
    it('creates a fee plan with matching installments and publishes FeePlanCreated event', async () => {
      const dto = {
        studentId: testStudentId,
        totalAmount: 10000,
        academicYear: '2026-2027',
        installments: [
          { installmentNo: 1, amount: 5000, dueDate: '2026-04-10' },
          { installmentNo: 2, amount: 5000, dueDate: '2026-05-10' },
        ],
      };

      const result = await feeService.createFeePlan(dto, testCoachingId, testUserId);

      expect(result.id).toBeDefined();
      expect(result.finalAmount).toBe(10000);
      expect(result.installments!.length).toBe(2);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: FEE_EVENTS.FEE_PLAN_CREATED,
          payload: expect.objectContaining({
            studentId: testStudentId,
            finalAmount: 10000,
            installmentsCount: 2,
          }),
        }),
      );
    });

    it('calculates percentage discount accurately and verifies installment total', async () => {
      const dto = {
        studentId: testStudentId,
        totalAmount: 10000,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10, // 10% discount -> 9000 final
        academicYear: '2026-2027',
        installments: [
          { installmentNo: 1, amount: 4500, dueDate: '2026-04-10' },
          { installmentNo: 2, amount: 4500, dueDate: '2026-05-10' },
        ],
      };

      const result = await feeService.createFeePlan(dto, testCoachingId, testUserId);

      expect(result.finalAmount).toBe(9000);
      expect(result.discountValue).toBe(10);
    });

    it('throws INVALID_INSTALLMENT_SUM when installment total does not match final amount', async () => {
      const dto = {
        studentId: testStudentId,
        totalAmount: 10000,
        academicYear: '2026-2027',
        installments: [
          { installmentNo: 1, amount: 4000, dueDate: '2026-04-10' },
          { installmentNo: 2, amount: 4000, dueDate: '2026-05-10' },
        ], // sums to 8000 instead of 10000
      };

      await expect(feeService.createFeePlan(dto, testCoachingId, testUserId)).rejects.toThrow(
        AppError,
      );
    });
  });

  describe('recordPayment', () => {
    it('records a partial payment and emits FeePaid event with remaining balance', async () => {
      const plan = await feeService.createFeePlan(
        {
          studentId: testStudentId,
          totalAmount: 5000,
          academicYear: '2026-2027',
          installments: [{ installmentNo: 1, amount: 5000, dueDate: '2026-04-10' }],
        },
        testCoachingId,
        testUserId,
      );

      const installmentId = plan.installments![0].id;

      const tx = await feeService.recordPayment(
        {
          installmentId,
          amount: 2000,
          paymentMethod: PaymentMethod.UPI,
          transactionRef: 'UPI-REF-12345',
        },
        testCoachingId,
        testUserId,
      );

      expect(tx.receiptNumber).toMatch(/^RCT\/\d{4}-\d{2}\/\d{5}$/);
      expect(tx.amount).toBe(2000);
      expect(tx.paymentMethod).toBe(PaymentMethod.UPI);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: FEE_EVENTS.FEE_PAID,
          payload: expect.objectContaining({
            installmentId,
            amount: 2000,
            remainingBalance: 3000,
            isFullyPaid: false,
          }),
        }),
      );
    });

    it('rejects payment that exceeds remaining installment balance', async () => {
      const plan = await feeService.createFeePlan(
        {
          studentId: testStudentId,
          totalAmount: 2000,
          academicYear: '2026-2027',
          installments: [{ installmentNo: 1, amount: 2000, dueDate: '2026-04-10' }],
        },
        testCoachingId,
        testUserId,
      );

      const installmentId = plan.installments![0].id;

      await expect(
        feeService.recordPayment(
          {
            installmentId,
            amount: 2500, // exceeds 2000 balance
            paymentMethod: PaymentMethod.CASH,
          },
          testCoachingId,
          testUserId,
        ),
      ).rejects.toThrow(AppError);
    });
  });

  describe('waiveInstallment', () => {
    it('successfully waives an unpaid installment and emits FeeWaived', async () => {
      const plan = await feeService.createFeePlan(
        {
          studentId: testStudentId,
          totalAmount: 3000,
          academicYear: '2026-2027',
          installments: [{ installmentNo: 1, amount: 3000, dueDate: '2026-04-10' }],
        },
        testCoachingId,
        testUserId,
      );

      const installmentId = plan.installments![0].id;

      const waived = await feeService.waiveInstallment(
        installmentId,
        { remarks: 'Special scholarship waiver' },
        testCoachingId,
        testUserId,
      );

      expect(waived.status).toBe(FeeInstallmentStatus.WAIVED);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: FEE_EVENTS.FEE_WAIVED,
          payload: expect.objectContaining({
            installmentId,
            studentId: testStudentId,
          }),
        }),
      );
    });

    it('rejects waiving an already fully paid installment', async () => {
      const plan = await feeService.createFeePlan(
        {
          studentId: testStudentId,
          totalAmount: 1000,
          academicYear: '2026-2027',
          installments: [{ installmentNo: 1, amount: 1000, dueDate: '2026-04-10' }],
        },
        testCoachingId,
        testUserId,
      );

      const installmentId = plan.installments![0].id;

      // Fully pay it
      await feeService.recordPayment(
        {
          installmentId,
          amount: 1000,
          paymentMethod: PaymentMethod.CASH,
        },
        testCoachingId,
        testUserId,
      );

      // Attempt waiver
      await expect(
        feeService.waiveInstallment(
          installmentId,
          { remarks: 'Waiver attempt' },
          testCoachingId,
          testUserId,
        ),
      ).rejects.toThrow(AppError);
    });
  });

  describe('getDefaulters', () => {
    it("lists overdue balances with the student's primary parent to remind", async () => {
      feeRepo.installments.set('inst-overdue', {
        id: 'inst-overdue',
        coachingId: 'coaching-1',
        installmentNo: 2,
        amount: 5000,
        paidAmount: 1500,
        dueDate: new Date('2026-09-01'),
        status: FeeInstallmentStatus.PARTIAL,
        feePlan: {
          student: {
            id: 's1',
            firstName: 'Aarav',
            lastName: 'Sharma',
            phone: null,
            email: null,
            studentParents: [
              { parent: { name: 'Old', phone: '1111111111', deletedAt: new Date() } },
              { parent: { name: 'Rakesh Sharma', phone: '9876543210', deletedAt: null } },
            ],
          },
        },
      });

      const [row] = await feeService.getDefaulters('coaching-1');

      expect(row).toMatchObject({
        installmentId: 'inst-overdue',
        pendingAmount: 3500,
        student: { id: 's1', name: 'Aarav Sharma' },
        parent: { name: 'Rakesh Sharma', phone: '9876543210' },
      });
    });
  });
});
