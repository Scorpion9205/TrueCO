import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { DiscountType, FeeInstallmentStatus, PaymentMethod } from '@trueco/types';

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
  amount: number;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  receiptNumber: string;
  remarks?: string;
  createdBy?: string;
}

export interface IFeeRepository {
  createFeePlan(input: CreateFeePlanInput): Promise<any>;
  findPlanById(id: string): Promise<any | null>;
  findPlansByStudent(studentId: string): Promise<any[]>;
  findInstallmentById(id: string): Promise<any | null>;
  findPendingInstallments(dueBeforeDate: Date): Promise<any[]>;
  recordPaymentTransaction(
    input: RecordPaymentTxInput,
  ): Promise<{ transaction: any; installment: any; plan: any }>;
  waiveInstallment(installmentId: string, remarks?: string): Promise<any>;
  generateReceiptNumber(_coachingId: string): Promise<string>;
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
          include: { student: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  public async recordPaymentTransaction(
    input: RecordPaymentTxInput,
  ): Promise<{ transaction: any; installment: any; plan: any }> {
    const rawPrisma = this.prisma as any;

    return rawPrisma.$transaction(async (tx: any) => {
      // 1. Fetch current installment
      const installment = await tx.feeInstallment.findUnique({
        where: { id: input.installmentId },
        include: { feePlan: true },
      });

      if (!installment) throw new Error('Fee installment not found');

      // 2. Create transaction record
      const transaction = await tx.feeTransaction.create({
        data: {
          coachingId: input.coachingId,
          installmentId: input.installmentId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          transactionRef: input.transactionRef,
          receiptNumber: input.receiptNumber,
          remarks: input.remarks,
          createdBy: input.createdBy,
        },
      });

      // 3. Update installment paid amount and status
      const currentPaid = Number(installment.paidAmount || 0);
      const totalCost = Number(installment.amount);
      const newPaid = currentPaid + input.amount;

      let newStatus: FeeInstallmentStatus;
      if (newPaid >= totalCost) {
        newStatus = FeeInstallmentStatus.PAID;
      } else {
        newStatus = FeeInstallmentStatus.PARTIAL;
      }

      const updatedInstallment = await tx.feeInstallment.update({
        where: { id: input.installmentId },
        data: {
          paidAmount: newPaid,
          status: newStatus,
        },
        include: {
          transactions: true,
        },
      });

      return {
        transaction,
        installment: updatedInstallment,
        plan: installment.feePlan,
      };
    });
  }

  public async waiveInstallment(installmentId: string, remarks?: string): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.feeInstallment.update({
      where: { id: installmentId },
      data: {
        status: FeeInstallmentStatus.WAIVED,
        ...(remarks && { remarks }),
      },
      include: {
        feePlan: { include: { student: true } },
      },
    });
  }

  public async generateReceiptNumber(_coachingId: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `RCP-${dateStr}-${rand}`;
  }
}
