import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { money, toRupees } from '../../common/money/money.js';
import { dateRange, timestampRange, todayInIndia } from '../reports/report.dates.js';

/** Last day of the month a YYYY-MM-DD falls in */
function monthEnd(day: string): string {
  const d = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** Fee rows of students still on the books */
const LIVE_PLAN = { feePlan: { deletedAt: null, student: { deletedAt: null } } };

export interface IDashboardRepository {
  getOwnerDashboardData(coachingId: string): Promise<any>;
  getTeacherDashboardData(coachingId: string, teacherId: string): Promise<any>;
  /** The teacher profile of a signed-in user (their user id is not their teacher id) */
  findTeacherIdByUserId(userId: string): Promise<string | null>;
}

export class PrismaDashboardRepository implements IDashboardRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async getOwnerDashboardData(coachingId: string): Promise<any> {
    const rawPrisma = this.prisma as any;

    // "Today" and "this month" are India's, whatever the server's clock zone
    const today = todayInIndia();
    const month = { startDate: `${today.slice(0, 7)}-01`, endDate: monthEnd(today) };
    const nextWeek = new Date(`${today}T00:00:00Z`);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

    const [
      totalStudents,
      totalTeachers,
      totalBatches,
      monthTransactions,
      monthExpenses,
      pendingInstallments,
      todayRecords,
      highRiskCount,
      recentActivities,
      upcomingInstallments,
    ] = await Promise.all([
      rawPrisma.student.count({ where: { coachingId, isActive: true, deletedAt: null } }),
      rawPrisma.teacher.count({ where: { coachingId, isActive: true, deletedAt: null } }),
      rawPrisma.batch.count({ where: { coachingId, isActive: true, deletedAt: null } }),
      rawPrisma.feeTransaction.findMany({
        where: {
          coachingId,
          deletedAt: null,
          paidAt: timestampRange(month),
        },
        select: { amount: true },
      }),
      rawPrisma.expense.findMany({
        where: {
          coachingId,
          deletedAt: null,
          expenseDate: dateRange(month),
        },
        select: { amount: true },
      }),
      rawPrisma.feeInstallment.findMany({
        where: {
          coachingId,
          deletedAt: null,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          dueDate: { lte: dateRange(month)!.lte },
          ...LIVE_PLAN,
        },
        select: { amount: true, paidAmount: true },
      }),
      // Today's classes (by class date, not when the register was saved)
      rawPrisma.attendanceRecord.findMany({
        where: {
          coachingId,
          session: { deletedAt: null, sessionDate: new Date(`${today}T00:00:00Z`) },
          student: { deletedAt: null },
        },
        select: { status: true },
      }),
      rawPrisma.riskScore.count({
        where: {
          coachingId,
          level: { in: ['HIGH', 'CRITICAL'] },
          student: { deletedAt: null, isActive: true },
        },
      }),
      rawPrisma.studentTimeline.findMany({
        where: { coachingId },
        include: { student: true },
        orderBy: { occurredAt: 'desc' },
        take: 8,
      }),
      rawPrisma.feeInstallment.findMany({
        where: {
          coachingId,
          deletedAt: null,
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { gte: new Date(`${today}T00:00:00Z`), lte: nextWeek },
          ...LIVE_PLAN,
        },
        include: {
          feePlan: { include: { student: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ]);

    const monthlyRevenue = toRupees(
      monthTransactions.reduce((acc: any, t: any) => acc.plus(money(t.amount)), money(0)),
    );
    const monthlyExpenses = toRupees(
      monthExpenses.reduce((acc: any, e: any) => acc.plus(money(e.amount)), money(0)),
    );
    const monthlyPendingFees = toRupees(
      pendingInstallments.reduce(
        (acc: any, i: any) => acc.plus(money(i.amount).minus(money(i.paidAmount))),
        money(0),
      ),
    );

    // Excused absences count neither way, as in the attendance report
    const counted = todayRecords.filter((r: any) => r.status !== 'EXCUSED');
    const presentCount = counted.filter(
      (r: any) => r.status === 'PRESENT' || r.status === 'LATE',
    ).length;
    // No records means attendance has not been marked yet today, not that everyone came
    const todayAttendanceRate =
      counted.length > 0 ? Number(((presentCount / counted.length) * 100).toFixed(2)) : null;

    return {
      metrics: {
        totalStudents,
        totalTeachers,
        totalBatches,
        monthlyRevenue,
        monthlyPendingFees,
        monthlyExpenses,
        todayAttendanceRate,
        highRiskCount,
      },
      recentActivities,
      upcomingInstallments,
    };
  }

  public async findTeacherIdByUserId(userId: string): Promise<string | null> {
    const teacher = await (this.prisma as any).teacher.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return teacher?.id ?? null;
  }

  public async getTeacherDashboardData(coachingId: string, teacherId: string): Promise<any> {
    const rawPrisma = this.prisma as any;

    // Today in India, as date-only columns store it
    const today = new Date(`${todayInIndia()}T00:00:00Z`);

    const teacherBatches = await rawPrisma.teacherBatch.findMany({
      // Deleted batches drop out; inactive ones stay so their history is still reachable
      where: { coachingId, teacherId, batch: { deletedAt: null } },
      include: {
        batch: {
          include: {
            batchStudents: { where: { leftAt: null } },
          },
        },
      },
    });

    const assignedBatches = teacherBatches.map((tb: any) => tb.batch).filter(Boolean);
    const batchIds = assignedBatches.map((b: any) => b.id);

    const [todaySessions, activeHomeworkCount] = await Promise.all([
      rawPrisma.attendanceSession.findMany({
        where: {
          coachingId,
          batchId: { in: batchIds },
          deletedAt: null,
          sessionDate: today,
        },
        include: {
          batch: true,
          records: true,
        },
      }),
      rawPrisma.homework.count({
        where: {
          coachingId,
          batchId: { in: batchIds },
          deletedAt: null,
          dueDate: { gte: today },
        },
      }),
    ]);

    return {
      assignedBatches,
      todaySessions,
      activeHomeworkCount,
    };
  }
}
