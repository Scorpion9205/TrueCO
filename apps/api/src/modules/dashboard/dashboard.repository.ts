import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface IDashboardRepository {
  getOwnerDashboardData(coachingId: string): Promise<any>;
  getTeacherDashboardData(coachingId: string, teacherId: string): Promise<any>;
}

export class PrismaDashboardRepository implements IDashboardRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async getOwnerDashboardData(coachingId: string): Promise<any> {
    const rawPrisma = this.prisma as any;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

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
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      rawPrisma.expense.findMany({
        where: {
          coachingId,
          deletedAt: null,
          expenseDate: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      rawPrisma.feeInstallment.findMany({
        where: {
          coachingId,
          deletedAt: null,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          dueDate: { lte: endOfMonth },
        },
      }),
      rawPrisma.attendanceRecord.findMany({
        where: {
          coachingId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      rawPrisma.riskScore.count({
        where: {
          coachingId,
          level: { in: ['HIGH', 'CRITICAL'] },
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
          dueDate: { gte: now, lte: nextWeek },
        },
        include: {
          feePlan: { include: { student: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ]);

    const monthlyRevenue = monthTransactions.reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    const monthlyExpenses = monthExpenses.reduce((acc: number, e: any) => acc + Number(e.amount), 0);
    const monthlyPendingFees = pendingInstallments.reduce(
      (acc: number, i: any) => acc + (Number(i.amount) - Number(i.paidAmount || 0)),
      0,
    );

    const presentCount = todayRecords.filter(
      (r: any) => r.status === 'PRESENT' || r.status === 'LATE',
    ).length;
    // No records means attendance has not been marked yet today, not that everyone came
    const todayAttendanceRate =
      todayRecords.length > 0
        ? Number(((presentCount / todayRecords.length) * 100).toFixed(2))
        : null;

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

  public async getTeacherDashboardData(coachingId: string, teacherId: string): Promise<any> {
    const rawPrisma = this.prisma as any;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const teacherBatches = await rawPrisma.teacherBatch.findMany({
      where: { coachingId, teacherId },
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
          sessionDate: { gte: todayStart, lte: todayEnd },
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
          dueDate: { gte: todayStart },
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
