import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { money, Money } from '../../common/money/money.js';
import { dateRange, ReportRange, timestampRange } from './report.dates.js';

export interface IReportRepository {
  /** Fee plans and their instalments, for students who are still on the books */
  getFeeData(coachingId: string): Promise<{
    plans: any[];
    installments: any[];
  }>;
  getAttendanceData(
    coachingId: string,
    batchId?: string,
    range?: ReportRange,
  ): Promise<{
    sessions: any[];
    records: any[];
  }>;
  getPnLData(
    coachingId: string,
    range?: ReportRange,
  ): Promise<{
    feeRevenue: Money;
    salaryExpenses: Money;
    generalExpenses: Money;
  }>;
}

const sum = (rows: Array<{ amount: unknown }>): Money =>
  rows.reduce((acc: Money, row) => acc.plus(money(row.amount as any)), money(0));

export class PrismaReportRepository implements IReportRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async getFeeData(coachingId: string): Promise<{ plans: any[]; installments: any[] }> {
    const rawPrisma = this.prisma as any;
    const livePlan = { deletedAt: null, student: { deletedAt: null } };

    const [plans, installments] = await Promise.all([
      rawPrisma.feePlan.findMany({
        where: { coachingId, ...livePlan },
        select: { id: true, finalAmount: true },
      }),
      rawPrisma.feeInstallment.findMany({
        where: { coachingId, deletedAt: null, feePlan: livePlan },
        include: {
          feePlan: {
            include: {
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
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return { plans, installments };
  }

  public async getAttendanceData(
    coachingId: string,
    batchId?: string,
    range: ReportRange = {},
  ): Promise<{ sessions: any[]; records: any[] }> {
    const rawPrisma = this.prisma as any;
    const sessionDate = dateRange(range);

    const sessions = await rawPrisma.attendanceSession.findMany({
      where: {
        coachingId,
        deletedAt: null,
        ...(batchId ? { batchId } : {}),
        ...(sessionDate ? { sessionDate } : {}),
      },
      include: { batch: { select: { id: true, name: true } } },
    });

    const records = await rawPrisma.attendanceRecord.findMany({
      where: {
        coachingId,
        sessionId: { in: sessions.map((s: any) => s.id) },
        student: { deletedAt: null },
      },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });

    return { sessions, records };
  }

  public async getPnLData(
    coachingId: string,
    range: ReportRange = {},
  ): Promise<{ feeRevenue: Money; salaryExpenses: Money; generalExpenses: Money }> {
    const rawPrisma = this.prisma as any;
    const paidAt = timestampRange(range);
    const expenseDate = dateRange(range);

    const [transactions, salaries, expenses] = await Promise.all([
      rawPrisma.feeTransaction.findMany({
        where: { coachingId, deletedAt: null, ...(paidAt ? { paidAt } : {}) },
        select: { amount: true },
      }),
      rawPrisma.salary.findMany({
        where: { coachingId, deletedAt: null, status: 'PAID', ...(paidAt ? { paidAt } : {}) },
        select: { amount: true },
      }),
      rawPrisma.expense.findMany({
        where: { coachingId, deletedAt: null, ...(expenseDate ? { expenseDate } : {}) },
        select: { amount: true },
      }),
    ]);

    return {
      feeRevenue: sum(transactions),
      salaryExpenses: sum(salaries),
      generalExpenses: sum(expenses),
    };
  }
}
