import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { PaymentMethod } from '@vargly/types';

// The mapper reports teacherName; without the relation every salary row was nameless
const WITH_TEACHER = { teacher: { select: { name: true } } } as const;

export interface CreateSalaryInput {
  coachingId: string;
  teacherId: string;
  amount: number;
  month: number;
  year: number;
  remarks?: string;
}

export interface RecordSalaryPaymentInput {
  paymentMethod: PaymentMethod;
  paidAt?: Date;
  remarks?: string;
}

export interface ISalaryRepository {
  create(input: CreateSalaryInput): Promise<any>;
  findById(id: string): Promise<any | null>;
  findByTeacher(teacherId: string): Promise<any[]>;
  findMany(
    coachingId: string,
    filter?: { teacherId?: string; month?: number; year?: number; status?: string },
  ): Promise<any[]>;
  /** Marks an unpaid salary paid; returns null if it was already paid (e.g. a concurrent request). */
  recordPayment(id: string, data: RecordSalaryPaymentInput): Promise<any | null>;
  getTeacherMonthlySalary(teacherId: string): Promise<number | null>;
}

export class PrismaSalaryRepository implements ISalaryRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async create(input: CreateSalaryInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.salary.create({
      data: {
        coachingId: input.coachingId,
        teacherId: input.teacherId,
        amount: input.amount,
        month: input.month,
        year: input.year,
        remarks: input.remarks,
        status: 'PENDING',
      },
      include: WITH_TEACHER,
    });
  }

  public async findById(id: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.salary.findFirst({
      where: { id, deletedAt: null },
      include: WITH_TEACHER,
    });
  }

  public async findByTeacher(teacherId: string): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.salary.findMany({
      where: { teacherId, deletedAt: null },
      include: WITH_TEACHER,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  public async findMany(
    coachingId: string,
    filter?: { teacherId?: string; month?: number; year?: number; status?: string },
  ): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.salary.findMany({
      where: {
        coachingId,
        deletedAt: null,
        ...(filter?.teacherId && { teacherId: filter.teacherId }),
        ...(filter?.month && { month: filter.month }),
        ...(filter?.year && { year: filter.year }),
        ...(filter?.status && { status: filter.status }),
      },
      include: WITH_TEACHER,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  public async recordPayment(id: string, data: RecordSalaryPaymentInput): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    // Conditional update: of two concurrent "pay" requests only one flips the status
    const { count } = await rawPrisma.salary.updateMany({
      where: { id, status: { not: 'PAID' } },
      data: {
        status: 'PAID',
        paymentMethod: data.paymentMethod,
        paidAt: data.paidAt || new Date(),
        ...(data.remarks && { remarks: data.remarks }),
      },
    });
    return count === 0 ? null : rawPrisma.salary.findUnique({ where: { id }, include: WITH_TEACHER });
  }

  public async getTeacherMonthlySalary(teacherId: string): Promise<number | null> {
    const rawPrisma = this.prisma as any;
    const teacher = await rawPrisma.teacher.findUnique({
      where: { id: teacherId },
      select: { monthlySalary: true },
    });
    return teacher?.monthlySalary ? Number(teacher.monthlySalary) : null;
  }
}
