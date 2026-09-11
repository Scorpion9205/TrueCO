import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { ConversationContext } from './dto/whatsapp-assistant.dto.js';

export interface StudentAcademicSnapshot {
  readonly student: any;
  readonly batch?: any;
  readonly feeSummary: {
    totalPending: number;
    upcomingDueDate?: Date;
  };
  readonly attendanceSummary: {
    totalClasses: number;
    attendedClasses: number;
    percentage: number;
  };
  readonly recentTestResult?: {
    testTitle: string;
    marksObtained: number;
    totalMarks: number;
    percentage: number;
  };
  readonly pendingHomework: any[];
}

export interface IWhatsAppAssistantRepository {
  resolveParentByPhone(phone: string): Promise<any | null>;
  getStudentAcademicSnapshot(studentId: string): Promise<StudentAcademicSnapshot | null>;
  getRecentNotices(coachingId: string, batchId?: string): Promise<any[]>;
  saveConversationContext(phone: string, context: ConversationContext): Promise<void>;
  getConversationContext(phone: string): Promise<ConversationContext | null>;
  isMessageProcessed(messageId: string): Promise<boolean>;
  markMessageProcessed(messageId: string): Promise<void>;
}

export class PrismaWhatsAppAssistantRepository implements IWhatsAppAssistantRepository {
  private readonly processedMessages = new Set<string>();
  private readonly conversationStates = new Map<string, ConversationContext>();

  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async resolveParentByPhone(phone: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10); // Match last 10 digits

    return rawPrisma.parent.findFirst({
      where: {
        phone: { contains: cleanPhone },
      },
      include: {
        studentParents: {
          include: {
            student: {
              include: {
                batchStudents: {
                  where: { leftAt: null },
                  include: { batch: true },
                },
              },
            },
          },
        },
      },
    });
  }

  public async getStudentAcademicSnapshot(studentId: string): Promise<StudentAcademicSnapshot | null> {
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

    const batch = student.batchStudents?.[0]?.batch;
    const now = new Date();

    // 1. Fee summary
    const pendingInstallments = await rawPrisma.feeInstallment.findMany({
      where: {
        feePlan: { studentId },
        deletedAt: null,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
    });

    const totalPending = pendingInstallments.reduce(
      (acc: number, inst: any) => acc + (Number(inst.amount) - Number(inst.paidAmount || 0)),
      0,
    );
    const upcomingDueDate = pendingInstallments[0]?.dueDate;

    // 2. Attendance summary
    const records = await rawPrisma.attendanceRecord.findMany({
      where: { studentId },
    });

    const attendedCount = records.filter(
      (r: any) => r.status === 'PRESENT' || r.status === 'LATE',
    ).length;
    const attendancePercentage =
      records.length > 0 ? Number(((attendedCount / records.length) * 100).toFixed(1)) : 100;

    // 3. Recent Test Result
    const recentResult = await rawPrisma.testResult.findFirst({
      where: { studentId },
      include: { test: true },
      orderBy: { createdAt: 'desc' },
    });

    let recentTestResult;
    if (recentResult && recentResult.test) {
      const marksObtained = Number(recentResult.marksObtained);
      const totalMarks = Number(recentResult.test.totalMarks);
      const percentage =
        totalMarks > 0 ? Number(((marksObtained / totalMarks) * 100).toFixed(1)) : 0;
      recentTestResult = {
        testTitle: recentResult.test.title,
        marksObtained,
        totalMarks,
        percentage,
      };
    }

    // 4. Pending Homework
    let pendingHomework: any[] = [];
    if (batch) {
      pendingHomework = await rawPrisma.homework.findMany({
        where: {
          batchId: batch.id,
          deletedAt: null,
          dueDate: { gte: now },
        },
        orderBy: { dueDate: 'asc' },
        take: 3,
      });
    }

    return {
      student,
      batch,
      feeSummary: {
        totalPending,
        upcomingDueDate,
      },
      attendanceSummary: {
        totalClasses: records.length,
        attendedClasses: attendedCount,
        percentage: attendancePercentage,
      },
      recentTestResult,
      pendingHomework,
    };
  }

  public async getRecentNotices(coachingId: string, batchId?: string): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notice.findMany({
      where: {
        coachingId,
        deletedAt: null,
        ...(batchId ? { OR: [{ batchId }, { batchId: null }] } : { batchId: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
  }

  public async saveConversationContext(phone: string, context: ConversationContext): Promise<void> {
    this.conversationStates.set(phone, context);
  }

  public async getConversationContext(phone: string): Promise<ConversationContext | null> {
    return this.conversationStates.get(phone) || null;
  }

  public async isMessageProcessed(messageId: string): Promise<boolean> {
    return this.processedMessages.has(messageId);
  }

  public async markMessageProcessed(messageId: string): Promise<void> {
    this.processedMessages.add(messageId);
  }
}
