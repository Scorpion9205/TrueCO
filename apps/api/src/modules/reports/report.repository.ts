import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface IReportRepository {
  getFeeData(coachingId: string): Promise<{
    plans: any[];
    installments: any[];
    transactions: any[];
  }>;
  getAttendanceData(
    coachingId: string,
    batchId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    sessions: any[];
    records: any[];
  }>;
  getPnLData(
    coachingId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    feeRevenue: number;
    salaryExpenses: number;
    generalExpenses: number;
  }>;
}

export class PrismaReportRepository implements IReportRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async getFeeData(coachingId: string): Promise<{
    plans: any[];
    installments: any[];
    transactions: any[];
  }> {
    const rawPrisma = this.prisma as any;

    const [plans, installments, transactions] = await Promise.all([
      rawPrisma.feePlan.findMany({
        where: { coachingId, deletedAt: null },
        include: {
          student: {
            include: {
              studentParents: { include: { parent: true } },
            },
          },
        },
      }),
      rawPrisma.feeInstallment.findMany({
        where: { coachingId, deletedAt: null },
        include: {
          feePlan: {
            include: {
              student: {
                include: {
                  studentParents: { include: { parent: true } },
                },
              },
            },
          },
        },
      }),
      rawPrisma.feeTransaction.findMany({
        where: { coachingId, deletedAt: null },
      }),
    ]);

    return { plans, installments, transactions };
  }

  public async getAttendanceData(
    coachingId: string,
    batchId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    sessions: any[];
    records: any[];
  }> {
    const rawPrisma = this.prisma as any;

    const sessionWhere: any = {
      coachingId,
      deletedAt: null,
      ...(batchId && { batchId }),
      ...(startDate && { sessionDate: { gte: startDate } }),
      ...(endDate && { sessionDate: { lte: endDate } }),
    };

    const sessions = await rawPrisma.attendanceSession.findMany({
      where: sessionWhere,
      include: { batch: true },
    });

    const sessionIds = sessions.map((s: any) => s.id);

    const records = await rawPrisma.attendanceRecord.findMany({
      where: {
        sessionId: { in: sessionIds },
      },
      include: {
        student: true,
      },
    });

    return { sessions, records };
  }

  public async getPnLData(
    coachingId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    feeRevenue: number;
    salaryExpenses: number;
    generalExpenses: number;
  }> {
    const rawPrisma = this.prisma as any;

    const txWhere: any = {
      coachingId,
      deletedAt: null,
      ...(startDate && { paidAt: { gte: startDate } }),
      ...(endDate && { paidAt: { lte: endDate } }),
    };

    const salaryWhere: any = {
      coachingId,
      deletedAt: null,
      status: 'PAID',
      ...(startDate && { paidAt: { gte: startDate } }),
      ...(endDate && { paidAt: { lte: endDate } }),
    };

    const expenseWhere: any = {
      coachingId,
      deletedAt: null,
      ...(startDate && { expenseDate: { gte: startDate } }),
      ...(endDate && { expenseDate: { lte: endDate } }),
    };

    const [transactions, salaries, expenses] = await Promise.all([
      rawPrisma.feeTransaction.findMany({ where: txWhere }),
      rawPrisma.salary.findMany({ where: salaryWhere }),
      rawPrisma.expense.findMany({ where: expenseWhere }),
    ]);

    const feeRevenue = transactions.reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    const salaryExpenses = salaries.reduce((acc: number, s: any) => acc + Number(s.amount), 0);
    const generalExpenses = expenses.reduce((acc: number, e: any) => acc + Number(e.amount), 0);

    return { feeRevenue, salaryExpenses, generalExpenses };
  }
}
