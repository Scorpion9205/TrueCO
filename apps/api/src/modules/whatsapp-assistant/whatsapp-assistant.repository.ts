import { RequestContextService } from '../../common/services/request-context.service.js';
import {
  getPrismaClient,
  ExtendedPrismaClient,
} from '../../database/prisma/tenant-prisma.extension.js';
import { ConversationContext } from './dto/whatsapp-assistant.dto.js';
import { Redis } from 'ioredis';
import { queueRegistry } from '../../queues/queue.registry.js';
import { logger } from '../../common/logger/logger.service.js';

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
  /**
   * Parents whose phone number matches exactly (last 10 digits, ignoring formatting), across all
   * coachings: one Vargly WhatsApp number serves every institute, so a parent may be registered
   * at several. Each result includes `coaching: { name }`.
   */
  resolveParentsByPhone(phone: string): Promise<any[]>;
  getStudentAcademicSnapshot(studentId: string): Promise<StudentAcademicSnapshot | null>;
  getRecentNotices(coachingId: string, batchId?: string): Promise<any[]>;
  saveConversationContext(coachingId: string, phone: string, context: ConversationContext): Promise<void>;
  getConversationContext(coachingId: string, phone: string): Promise<ConversationContext | null>;
  /** Which coaching a parent registered at several institutes chose to talk to. */
  saveCoachingChoice(phone: string, coachingId: string): Promise<void>;
  getCoachingChoice(phone: string): Promise<string | null>;
  /**
   * Atomically claims an inbound message id; false if it was already claimed (Meta redelivers
   * webhooks). Release the claim if processing fails so a retry can handle it.
   */
  claimMessage(messageId: string): Promise<boolean>;
  releaseMessage(messageId: string): Promise<void>;
}

/** Last 10 digits of a phone number, ignoring spaces, dashes and country code. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

const MESSAGE_CLAIM_TTL_SECONDS = 7 * 24 * 60 * 60;
const CONVERSATION_TTL_SECONDS = 24 * 60 * 60;
const COACHING_CHOICE_TTL_SECONDS = 30 * 24 * 60 * 60;

export class PrismaWhatsAppAssistantRepository implements IWhatsAppAssistantRepository {

  public constructor(
    private readonly prisma: ExtendedPrismaClient = getPrismaClient(),
    private readonly redis: () => Redis = () => queueRegistry.getRedisClient(),
  ) {}

  public async resolveParentsByPhone(phone: string): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 10) return [];

    // The sender's coaching is unknown until this lookup succeeds, so it spans all tenants.
    // `contains` narrows the search; the exact comparison below drops partial matches such as a
    // longer number that merely contains these digits.
    const candidates = await RequestContextService.runAsSystem('whatsapp:resolve-parent', () =>
      rawPrisma.parent.findMany({
        where: { phone: { contains: cleanPhone } },
        include: {
          coaching: { select: { name: true } },
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
      }),
    );
    return candidates.filter((p: any) => normalizePhone(p.phone) === cleanPhone);
  }

  public async getStudentAcademicSnapshot(
    studentId: string,
  ): Promise<StudentAcademicSnapshot | null> {
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

  public async saveConversationContext(
    coachingId: string,
    phone: string,
    context: ConversationContext,
  ): Promise<void> {
    await this.redisSet(`wa:conv:${coachingId}:${normalizePhone(phone)}`, JSON.stringify(context), CONVERSATION_TTL_SECONDS);
  }

  public async getConversationContext(coachingId: string, phone: string): Promise<ConversationContext | null> {
    const raw = await this.redisGet(`wa:conv:${coachingId}:${normalizePhone(phone)}`);
    if (!raw) return null;
    const context = JSON.parse(raw);
    return { ...context, lastInteractionAt: new Date(context.lastInteractionAt) };
  }

  public async saveCoachingChoice(phone: string, coachingId: string): Promise<void> {
    await this.redisSet(`wa:coaching-choice:${normalizePhone(phone)}`, coachingId, COACHING_CHOICE_TTL_SECONDS);
  }

  public async getCoachingChoice(phone: string): Promise<string | null> {
    return this.redisGet(`wa:coaching-choice:${normalizePhone(phone)}`);
  }

  public async claimMessage(messageId: string): Promise<boolean> {
    try {
      const result = await this.redis().set(`wa:inbound:${messageId}`, '1', 'EX', MESSAGE_CLAIM_TTL_SECONDS, 'NX');
      return result === 'OK';
    } catch (err) {
      // Without Redis we cannot deduplicate; the queue's job id still drops most repeats
      logger.warn('[WhatsAppAssistantRepository] Message claim unavailable; processing without dedupe', {
        messageId,
        error: (err as Error).message,
      });
      return true;
    }
  }

  public async releaseMessage(messageId: string): Promise<void> {
    await this.redis()
      .del(`wa:inbound:${messageId}`)
      .catch(() => undefined);
  }

  private async redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis().set(key, value, 'EX', ttlSeconds);
    } catch (err) {
      logger.warn('[WhatsAppAssistantRepository] Could not save conversation state', { key, error: (err as Error).message });
    }
  }

  private async redisGet(key: string): Promise<string | null> {
    try {
      return await this.redis().get(key);
    } catch {
      return null;
    }
  }

}
