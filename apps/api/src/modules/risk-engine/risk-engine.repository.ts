import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { RiskLevel } from '@trueco/types';
import { RiskFilterDto } from './dto/risk-engine.dto.js';

export interface UpsertRiskScoreInput {
  coachingId: string;
  studentId: string;
  score: number;
  level: RiskLevel;
  attendanceFactor: number;
  marksFactor: number;
  feeFactor: number;
  homeworkFactor: number;
  narrative?: string;
}

export interface IRiskEngineRepository {
  getStudentAcademicData(studentId: string): Promise<{
    student: any;
    attendanceRecords: any[];
    testResults: any[];
    feeInstallments: any[];
    homeworkList: any[];
  } | null>;
  upsertRiskScore(input: UpsertRiskScoreInput): Promise<any>;
  findByStudentId(studentId: string): Promise<any | null>;
  findMany(coachingId: string, filter?: RiskFilterDto): Promise<any[]>;
  getAllActiveStudentIds(coachingId: string): Promise<string[]>;
}

export class PrismaRiskEngineRepository implements IRiskEngineRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async getStudentAcademicData(studentId: string): Promise<{
    student: any;
    attendanceRecords: any[];
    testResults: any[];
    feeInstallments: any[];
    homeworkList: any[];
  } | null> {
    const rawPrisma = this.prisma as any;

    const student = await rawPrisma.student.findUnique({
      where: { id: studentId },
      include: {
        batchStudents: {
          where: { leftAt: null },
          include: { batch: true },
        },
      },
    });

    if (!student) return null;

    const batchId = student.batchStudents?.[0]?.batchId;

    const [attendanceRecords, testResults, feeInstallments, homeworkList] = await Promise.all([
      rawPrisma.attendanceRecord.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 30, // Last 30 sessions
      }),
      rawPrisma.testResult.findMany({
        where: { studentId },
        include: { test: true },
        orderBy: { createdAt: 'desc' },
        take: 10, // Last 10 tests
      }),
      rawPrisma.feeInstallment.findMany({
        where: {
          feePlan: { studentId },
          deletedAt: null,
        },
        orderBy: { dueDate: 'asc' },
      }),
      batchId
        ? rawPrisma.homework.findMany({
            where: { batchId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    return {
      student,
      attendanceRecords,
      testResults,
      feeInstallments,
      homeworkList,
    };
  }

  public async upsertRiskScore(input: UpsertRiskScoreInput): Promise<any> {
    const rawPrisma = this.prisma as any;

    return rawPrisma.riskScore.upsert({
      where: { studentId: input.studentId },
      create: {
        coachingId: input.coachingId,
        studentId: input.studentId,
        score: input.score,
        level: input.level,
        attendanceFactor: input.attendanceFactor,
        marksFactor: input.marksFactor,
        feeFactor: input.feeFactor,
        homeworkFactor: input.homeworkFactor,
        narrative: input.narrative || null,
        computedAt: new Date(),
      },
      update: {
        score: input.score,
        level: input.level,
        attendanceFactor: input.attendanceFactor,
        marksFactor: input.marksFactor,
        feeFactor: input.feeFactor,
        homeworkFactor: input.homeworkFactor,
        narrative: input.narrative || null,
        computedAt: new Date(),
      },
      include: { student: true },
    });
  }

  public async findByStudentId(studentId: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.riskScore.findUnique({
      where: { studentId },
      include: { student: true },
    });
  }

  public async findMany(coachingId: string, filter?: RiskFilterDto): Promise<any[]> {
    const rawPrisma = this.prisma as any;

    return rawPrisma.riskScore.findMany({
      where: {
        coachingId,
        ...(filter?.level && { level: filter.level }),
        ...(filter?.minScore !== undefined && { score: { gte: filter.minScore } }),
        ...(filter?.maxScore !== undefined && { score: { lte: filter.maxScore } }),
      },
      include: { student: true },
      orderBy: { score: 'desc' },
    });
  }

  public async getAllActiveStudentIds(coachingId: string): Promise<string[]> {
    const rawPrisma = this.prisma as any;
    const students = await rawPrisma.student.findMany({
      where: { coachingId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    return students.map((s: any) => s.id);
  }
}
