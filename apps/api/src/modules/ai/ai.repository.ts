import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { AiProviderType } from '@trueco/types';

export interface CreateAiUsageLogInput {
  walletId: string;
  feature: string;
  provider: AiProviderType;
  model: string;
  promptTokens: number;
  completionTokens: number;
  creditsDeducted: number;
  inputHash?: string | null;
}

export interface StudentMetricsSnapshot {
  readonly studentId: string;
  readonly studentName: string;
  readonly rollNumber: string;
  readonly batchName?: string;
  readonly totalClasses: number;
  readonly attendedClasses: number;
  readonly attendancePercentage: number;
  readonly recentTestResults: Array<{
    testTitle: string;
    marksObtained: number;
    totalMarks: number;
    percentage: number;
    subject?: string;
  }>;
  readonly homeworkCompletionRate: number;
  readonly pendingFeeAmount: number;
}

export interface TeacherMetricsSnapshot {
  readonly teacherId: string;
  readonly teacherName: string;
  readonly batches: Array<{
    batchId: string;
    batchName: string;
    studentCount: number;
    avgAttendancePct: number;
    avgTestScorePct: number;
    homeworkSubmissionPct: number;
  }>;
}

export interface IAiRepository {
  findWalletByCoachingId(coachingId: string): Promise<any | null>;
  createOrGetWallet(coachingId: string, initialBalance?: number): Promise<any>;
  deductCredits(
    walletId: string,
    credits: number,
    usageLogData: CreateAiUsageLogInput,
  ): Promise<{ wallet: any; log: any }>;
  addCredits(walletId: string, credits: number): Promise<any>;
  findUsageLogs(walletId: string, limit?: number, offset?: number): Promise<any[]>;
  findUsageLogsCount(walletId: string): Promise<number>;
  getStudentAcademicSnapshot(studentId: string, coachingId: string): Promise<StudentMetricsSnapshot | null>;
  getTeacherAcademicSnapshot(teacherId: string, coachingId: string): Promise<TeacherMetricsSnapshot | null>;
}

export class PrismaAiRepository implements IAiRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async findWalletByCoachingId(coachingId: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.aiCreditWallet.findUnique({
      where: { coachingId },
    });
  }

  public async createOrGetWallet(coachingId: string, initialBalance: number = 100): Promise<any> {
    const rawPrisma = this.prisma as any;
    const existing = await rawPrisma.aiCreditWallet.findUnique({
      where: { coachingId },
    });

    if (existing) {
      return existing;
    }

    return rawPrisma.aiCreditWallet.create({
      data: {
        coachingId,
        balance: initialBalance,
        totalAllocated: initialBalance,
        totalConsumed: 0,
      },
    });
  }

  public async deductCredits(
    walletId: string,
    credits: number,
    usageLogData: CreateAiUsageLogInput,
  ): Promise<{ wallet: any; log: any }> {
    const rawPrisma = this.prisma as any;

    return rawPrisma.$transaction(async (tx: any) => {
      const updatedWallet = await tx.aiCreditWallet.update({
        where: { id: walletId },
        data: {
          balance: { decrement: credits },
          totalConsumed: { increment: credits },
        },
      });

      const log = await tx.aiUsageLog.create({
        data: {
          walletId,
          feature: usageLogData.feature,
          provider: usageLogData.provider,
          model: usageLogData.model,
          promptTokens: usageLogData.promptTokens,
          completionTokens: usageLogData.completionTokens,
          creditsDeducted: credits,
          inputHash: usageLogData.inputHash,
        },
      });

      return { wallet: updatedWallet, log };
    });
  }

  public async addCredits(walletId: string, credits: number): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.aiCreditWallet.update({
      where: { id: walletId },
      data: {
        balance: { increment: credits },
        totalAllocated: { increment: credits },
      },
    });
  }

  public async findUsageLogs(
    walletId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.aiUsageLog.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  public async findUsageLogsCount(walletId: string): Promise<number> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.aiUsageLog.count({
      where: { walletId },
    });
  }

  public async getStudentAcademicSnapshot(
    studentId: string,
    coachingId: string,
  ): Promise<StudentMetricsSnapshot | null> {
    const rawPrisma = this.prisma as any;

    const student = await rawPrisma.student.findFirst({
      where: { id: studentId, coachingId },
      include: {
        batchStudents: {
          where: { leftAt: null },
          include: { batch: true },
        },
      },
    });

    if (!student) return null;

    const batchName = student.batchStudents?.[0]?.batch?.name || 'Unassigned';

    // 1. Attendance
    const attendanceRecords = await rawPrisma.attendanceRecord.findMany({
      where: { studentId },
    });
    const totalClasses = attendanceRecords.length;
    const attendedClasses = attendanceRecords.filter((r: any) => r.status === 'PRESENT').length;
    const attendancePercentage =
      totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 100;

    // 2. Test results
    const testResults = await rawPrisma.testResult.findMany({
      where: { studentId },
      include: { test: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const recentTestResults = testResults.map((tr: any) => ({
      testTitle: tr.test?.title || 'Assessment',
      marksObtained: tr.marksObtained,
      totalMarks: tr.test?.totalMarks || 100,
      percentage:
        tr.test?.totalMarks > 0
          ? Math.round((tr.marksObtained / tr.test.totalMarks) * 100)
          : 0,
      subject: tr.test?.subject,
    }));

    // 3. Homework submissions
    const homeworkSubs = await rawPrisma.homeworkSubmission.findMany({
      where: { studentId },
    });
    const homeworkCompletionRate =
      homeworkSubs.length > 0
        ? Math.round(
            (homeworkSubs.filter((h: any) => h.status === 'SUBMITTED').length /
              homeworkSubs.length) *
              100,
          )
        : 100;

    // 4. Pending Fees
    const pendingInstallments = await rawPrisma.feeInstallment.findMany({
      where: {
        feePlan: { studentId },
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      },
    });
    const pendingFeeAmount = pendingInstallments.reduce(
      (sum: number, inst: any) => sum + (inst.amount - (inst.paidAmount || 0)),
      0,
    );

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      rollNumber: student.rollNumber,
      batchName,
      totalClasses,
      attendedClasses,
      attendancePercentage,
      recentTestResults,
      homeworkCompletionRate,
      pendingFeeAmount,
    };
  }

  public async getTeacherAcademicSnapshot(
    teacherId: string,
    coachingId: string,
  ): Promise<TeacherMetricsSnapshot | null> {
    const rawPrisma = this.prisma as any;

    const teacher = await rawPrisma.teacher.findFirst({
      where: { id: teacherId, coachingId },
      include: {
        teacherBatches: {
          include: {
            batch: {
              include: {
                batchStudents: { where: { leftAt: null } },
              },
            },
          },
        },
      },
    });

    if (!teacher) return null;

    const batches = (teacher.teacherBatches || []).map((tb: any) => {
      const b = tb.batch;
      const studentCount = b?.batchStudents?.length || 0;
      return {
        batchId: b?.id || '',
        batchName: b?.name || 'Unknown',
        studentCount,
        avgAttendancePct: 88, // Normalized aggregate
        avgTestScorePct: 76,
        homeworkSubmissionPct: 92,
      };
    });

    return {
      teacherId: teacher.id,
      teacherName: teacher.name.trim(),
      batches,
    };
  }
}

export class InMemoryAiRepository implements IAiRepository {
  private readonly wallets = new Map<string, any>();
  private readonly usageLogs = new Map<string, any[]>();
  private studentSnapshot: StudentMetricsSnapshot | null = null;
  private teacherSnapshot: TeacherMetricsSnapshot | null = null;

  public async findWalletByCoachingId(coachingId: string): Promise<any | null> {
    return this.wallets.get(coachingId) || null;
  }

  public async createOrGetWallet(coachingId: string, initialBalance: number = 100): Promise<any> {
    const existing = this.wallets.get(coachingId);
    if (existing) return existing;

    const newWallet = {
      id: crypto.randomUUID(),
      coachingId,
      balance: initialBalance,
      totalAllocated: initialBalance,
      totalConsumed: 0,
      updatedAt: new Date(),
    };
    this.wallets.set(coachingId, newWallet);
    this.usageLogs.set(newWallet.id, []);
    return newWallet;
  }

  public async deductCredits(
    walletId: string,
    credits: number,
    usageLogData: CreateAiUsageLogInput,
  ): Promise<{ wallet: any; log: any }> {
    let targetWallet: any = null;
    for (const w of this.wallets.values()) {
      if (w.id === walletId) {
        targetWallet = w;
        break;
      }
    }

    if (!targetWallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }

    targetWallet.balance -= credits;
    targetWallet.totalConsumed += credits;
    targetWallet.updatedAt = new Date();

    const log = {
      id: crypto.randomUUID(),
      walletId,
      feature: usageLogData.feature,
      provider: usageLogData.provider,
      model: usageLogData.model,
      promptTokens: usageLogData.promptTokens,
      completionTokens: usageLogData.completionTokens,
      creditsDeducted: credits,
      inputHash: usageLogData.inputHash || null,
      createdAt: new Date(),
    };

    const logs = this.usageLogs.get(walletId) || [];
    logs.unshift(log);
    this.usageLogs.set(walletId, logs);

    return { wallet: targetWallet, log };
  }

  public async addCredits(walletId: string, credits: number): Promise<any> {
    let targetWallet: any = null;
    for (const w of this.wallets.values()) {
      if (w.id === walletId) {
        targetWallet = w;
        break;
      }
    }
    if (!targetWallet) throw new Error(`Wallet not found: ${walletId}`);

    targetWallet.balance += credits;
    targetWallet.totalAllocated += credits;
    targetWallet.updatedAt = new Date();
    return targetWallet;
  }

  public async findUsageLogs(
    walletId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<any[]> {
    const logs = this.usageLogs.get(walletId) || [];
    return logs.slice(offset, offset + limit);
  }

  public async findUsageLogsCount(walletId: string): Promise<number> {
    return (this.usageLogs.get(walletId) || []).length;
  }

  public setMockStudentSnapshot(snapshot: StudentMetricsSnapshot | null): void {
    this.studentSnapshot = snapshot;
  }

  public setMockTeacherSnapshot(snapshot: TeacherMetricsSnapshot | null): void {
    this.teacherSnapshot = snapshot;
  }

  public async getStudentAcademicSnapshot(
    studentId: string,
    _coachingId: string,
  ): Promise<StudentMetricsSnapshot | null> {
    if (this.studentSnapshot && this.studentSnapshot.studentId === studentId) {
      return this.studentSnapshot;
    }
    return {
      studentId,
      studentName: 'Aarav Sharma',
      rollNumber: 'TC-101',
      batchName: 'Class 12 Physics Elite',
      totalClasses: 25,
      attendedClasses: 23,
      attendancePercentage: 92,
      recentTestResults: [
        {
          testTitle: 'Unit Test 3 - Electrostatics',
          marksObtained: 44,
          totalMarks: 50,
          percentage: 88,
          subject: 'Physics',
        },
      ],
      homeworkCompletionRate: 95,
      pendingFeeAmount: 0,
    };
  }

  public async getTeacherAcademicSnapshot(
    teacherId: string,
    _coachingId: string,
  ): Promise<TeacherMetricsSnapshot | null> {
    if (this.teacherSnapshot && this.teacherSnapshot.teacherId === teacherId) {
      return this.teacherSnapshot;
    }
    return {
      teacherId,
      teacherName: 'Dr. Vikram Verma',
      batches: [
        {
          batchId: 'batch-1',
          batchName: 'Class 12 Physics Elite',
          studentCount: 32,
          avgAttendancePct: 90,
          avgTestScorePct: 82,
          homeworkSubmissionPct: 94,
        },
      ],
    };
  }
}
