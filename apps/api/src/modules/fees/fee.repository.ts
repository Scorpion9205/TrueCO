import { StatusCodes } from 'http-status-codes';
import { readPreferences } from '../settings/settings.preferences.js';
import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { DiscountType, FeeInstallmentStatus, PaymentMethod } from '@trueco/types';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { money, MoneyInput, Money } from '../../common/money/money.js';
import { nextDocumentNumber } from '../../common/money/document-number.js';

export interface CreateFeePlanInput {
  coachingId: string;
  studentId: string;
  totalAmount: number;
  discountType?: DiscountType;
  discountValue?: number;
  finalAmount: number;
  academicYear: string;
  createdBy?: string;
  installments: Array<{
    installmentNo: number;
    amount: number;
    dueDate: Date;
  }>;
}

export interface RecordPaymentTxInput {
  coachingId: string;
  installmentId: string;
  amount: MoneyInput;
  paymentMethod: PaymentMethod;
  /** Gateway payment id for online payments; a repeat of it is reported as a duplicate. */
  transactionRef?: string;
  remarks?: string;
  createdBy?: string;
}

export type RecordPaymentResult =
  | {
      readonly kind: 'recorded';
      readonly transaction: any;
      readonly installment: any;
      readonly plan: any;
      readonly remainingBalance: Money;
    }
  | { readonly kind: 'duplicate'; readonly transaction: any };

export interface IFeeRepository {
  createFeePlan(input: CreateFeePlanInput): Promise<any>;
  findPlanById(id: string): Promise<any | null>;
  findPlansByStudent(studentId: string): Promise<any[]>;
  findInstallmentById(id: string): Promise<any | null>;
  findPendingInstallments(dueBeforeDate: Date): Promise<any[]>;
  /** Active coachings in id order, for schedulers that page through tenants. */
  listCoachingsForReminders(afterId: string | undefined, take: number): Promise<Array<{ id: string; timezone: string | null }>>;
  /** Unpaid installments of the current tenant due within [from, to], in id order. */
  findInstallmentsDueBetween(from: Date, to: Date, afterId: string | undefined, take: number): Promise<any[]>;
  /**
   * Records a payment atomically: serialises payments on the installment, rejects overpayment,
   * collapses repeats of the same gateway payment, and issues the next receipt number.
   */
  recordPaymentTransaction(input: RecordPaymentTxInput): Promise<RecordPaymentResult>;
  /** Waives a pending or partly paid installment; returns null if it was paid or waived meanwhile. */
  waiveInstallment(installmentId: string, remarks?: string): Promise<any | null>;
}

export class PrismaFeeRepository implements IFeeRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async createFeePlan(input: CreateFeePlanInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.feePlan.create({
      data: {
        coachingId: input.coachingId,
        studentId: input.studentId,
        totalAmount: input.totalAmount,
        discountType: input.discountType,
        discountValue: input.discountValue,
        finalAmount: input.finalAmount,
        academicYear: input.academicYear,
        createdBy: input.createdBy,
        installments: {
          create: input.installments.map((inst) => ({
            coachingId: input.coachingId,
            installmentNo: inst.installmentNo,
            amount: inst.amount,
            dueDate: inst.dueDate,
            status: FeeInstallmentStatus.PENDING,
          })),
        },
      },
      include: {
        installments: {
          orderBy: { installmentNo: 'asc' },
        },
        student: true,
      },
    });
  }

  public async findPlanById(id: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.feePlan.findFirst({
      where: { id, deletedAt: null },
      include: {
        installments: {
          include: { transactions: true },
          orderBy: { installmentNo: 'asc' },
        },
        student: true,
      },
    });
  }

  public async findPlansByStudent(studentId: string): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.feePlan.findMany({
      where: { studentId, deletedAt: null },
      include: {
        installments: {
          include: { transactions: true },
          orderBy: { installmentNo: 'asc' },
        },
        student: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findInstallmentById(id: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.feeInstallment.findFirst({
      where: { id, deletedAt: null },
      include: {
        feePlan: {
          include: { student: true },
        },
        transactions: true,
      },
    });
  }

  public async findPendingInstallments(dueBeforeDate: Date): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.feeInstallment.findMany({
      where: {
        status: {
          in: [FeeInstallmentStatus.PENDING, FeeInstallmentStatus.PARTIAL],
        },
        dueDate: { lte: dueBeforeDate },
        deletedAt: null,
      },
      include: {
        feePlan: {
          include: {
            // Parents are who fee reminders go to; the primary contact comes first
            student: {
              include: {
                studentParents: {
                  include: { parent: true },
                  orderBy: { isPrimary: 'desc' },
                },
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  public async listCoachingsForReminders(
    afterId: string | undefined,
    take: number,
  ): Promise<Array<{ id: string; timezone: string | null }>> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.coaching.findMany({
      where: { isActive: true, ...(afterId ? { id: { gt: afterId } } : {}) },
      select: { id: true, timezone: true },
      orderBy: { id: 'asc' },
      take,
    });
  }

  public async findInstallmentsDueBetween(
    from: Date,
    to: Date,
    afterId: string | undefined,
    take: number,
  ): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.feeInstallment.findMany({
      where: {
        status: { in: [FeeInstallmentStatus.PENDING, FeeInstallmentStatus.PARTIAL] },
        dueDate: { gte: from, lte: to },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      include: { feePlan: { select: { studentId: true } } },
      orderBy: { id: 'asc' },
      take,
    });
  }

  public async recordPaymentTransaction(input: RecordPaymentTxInput): Promise<RecordPaymentResult> {
    const rawPrisma = this.prisma as any;
    const amount = money(input.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new AppError('INVALID_AMOUNT', 'Payment amount must be greater than zero', StatusCodes.BAD_REQUEST);
    }

    return rawPrisma.$transaction(async (tx: any) => {
      // 1. Lock the installment: concurrent payments on it now run one after another
      const locked: Array<{ id: string }> = await tx.$queryRaw`
        SELECT id FROM fee_installments
        WHERE id = ${input.installmentId}::uuid AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new AppError('INSTALLMENT_NOT_FOUND', 'Fee installment not found', StatusCodes.NOT_FOUND);
      }

      // 2. Checked after the lock, so a concurrent delivery of the same gateway payment sees
      //    the row the first one committed
      if (input.transactionRef) {
        const existing = await tx.feeTransaction.findFirst({
          where: { transactionRef: input.transactionRef },
        });
        if (existing) return { kind: 'duplicate', transaction: existing } as const;
      }

      const installment = await tx.feeInstallment.findUnique({
        where: { id: input.installmentId },
        include: { feePlan: true },
      });
      if (installment.status === FeeInstallmentStatus.PAID) {
        throw new AppError('INSTALLMENT_ALREADY_PAID', 'This installment is already fully paid', StatusCodes.CONFLICT);
      }
      if (installment.status === FeeInstallmentStatus.WAIVED) {
        throw new AppError('INSTALLMENT_WAIVED', 'Cannot accept payment for a waived installment', StatusCodes.CONFLICT);
      }

      // 3. Exact decimal arithmetic on the locked, current balance
      const total = money(installment.amount);
      const alreadyPaid = money(installment.paidAmount);
      const remaining = total.minus(alreadyPaid);
      if (amount.greaterThan(remaining)) {
        throw new AppError(
          'AMOUNT_EXCEEDS_BALANCE',
          `Payment amount (${amount.toFixed(2)}) exceeds remaining balance (${remaining.toFixed(2)})`,
          StatusCodes.BAD_REQUEST,
        );
      }

      // 4. Gap-free receipt number, issued in this transaction
      const { receiptPrefix } = await readPreferences(tx, input.coachingId);
      const receiptNumber = await nextDocumentNumber(tx, input.coachingId, receiptPrefix);

      const transaction = await tx.feeTransaction.create({
        data: {
          coachingId: input.coachingId,
          installmentId: input.installmentId,
          amount,
          paymentMethod: input.paymentMethod,
          transactionRef: input.transactionRef,
          receiptNumber,
          remarks: input.remarks,
          createdBy: input.createdBy,
        },
      });

      const newPaid = alreadyPaid.plus(amount);
      const updatedInstallment = await tx.feeInstallment.update({
        where: { id: input.installmentId },
        data: {
          paidAmount: newPaid,
          status: newPaid.greaterThanOrEqualTo(total) ? FeeInstallmentStatus.PAID : FeeInstallmentStatus.PARTIAL,
        },
        include: { transactions: true },
      });

      return {
        kind: 'recorded',
        transaction,
        installment: updatedInstallment,
        plan: installment.feePlan,
        remainingBalance: total.minus(newPaid),
      } as const;
    });
  }

  public async waiveInstallment(installmentId: string, remarks?: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    // Conditional update: loses cleanly to a payment that completed the installment first
    const { count } = await rawPrisma.feeInstallment.updateMany({
      where: {
        id: installmentId,
        status: { in: [FeeInstallmentStatus.PENDING, FeeInstallmentStatus.PARTIAL] },
      },
      data: { status: FeeInstallmentStatus.WAIVED, ...(remarks ? { remarks } : {}) },
    });
    if (count === 0) return null;

    return rawPrisma.feeInstallment.findUnique({
      where: { id: installmentId },
      include: { feePlan: { include: { student: true } } },
    });
  }
}
