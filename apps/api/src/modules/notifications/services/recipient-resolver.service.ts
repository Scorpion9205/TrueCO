import { ExtendedPrismaClient, getPrismaClient } from '../../../database/prisma/tenant-prisma.extension.js';
import { logger } from '../../../common/logger/logger.service.js';

export interface ResolvedRecipient {
  readonly recipientId: string;
  readonly phone?: string;
  readonly email?: string;
  readonly name: string;
  readonly recipientType: 'PARENT' | 'STUDENT' | 'TEACHER';
}

export class RecipientResolverService {
  private static instance: RecipientResolverService;

  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public static getInstance(): RecipientResolverService {
    if (!RecipientResolverService.instance) {
      RecipientResolverService.instance = new RecipientResolverService();
    }
    return RecipientResolverService.instance;
  }

  /**
   * Resolves an abstract recipient token (e.g. "student:<id>:parent", "batch:<id>:students")
   * into concrete resolved recipient records with real phone and email values.
   */
  public async resolveRecipients(
    recipientToken: string,
    coachingId: string,
  ): Promise<ResolvedRecipient[]> {
    // If it's already a raw phone number (digits) or email (contains @), return as-is
    if (/^\+?\d{8,15}$/.test(recipientToken.trim())) {
      return [
        {
          recipientId: recipientToken,
          phone: recipientToken.trim(),
          name: 'Direct Contact',
          recipientType: 'PARENT',
        },
      ];
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientToken.trim())) {
      return [
        {
          recipientId: recipientToken,
          email: recipientToken.trim(),
          name: 'Direct Contact',
          recipientType: 'PARENT',
        },
      ];
    }

    const parts = recipientToken.split(':');

    // 1. student:<studentId>:parent
    if (parts[0] === 'student' && parts[2] === 'parent') {
      const studentId = parts[1];
      const student = await (this.prisma as any).student.findFirst({
        where: { id: studentId, coachingId, deletedAt: null },
        include: {
          studentParents: {
            include: {
              parent: true,
            },
          },
        },
      });

      if (!student) {
        logger.warn(`[RecipientResolver] Student not found for token: ${recipientToken}`);
        return [];
      }

      // Find primary parent or first linked parent
      const sp = student.studentParents?.find((p: any) => p.isPrimary) || student.studentParents?.[0];
      if (sp?.parent) {
        return [
          {
            recipientId: sp.parent.id,
            phone: sp.parent.phone,
            email: sp.parent.email || undefined,
            name: sp.parent.name || [sp.parent.firstName, sp.parent.lastName].filter(Boolean).join(' ') || 'Parent',
            recipientType: 'PARENT',
          },
        ];
      }

      // Fallback to student phone/email if no parent is linked
      if (student.phone || student.email) {
        return [
          {
            recipientId: student.id,
            phone: student.phone || undefined,
            email: student.email || undefined,
            name: `${student.firstName} ${student.lastName}`,
            recipientType: 'PARENT',
          },
        ];
      }

      logger.warn(`[RecipientResolver] No parent contact found for student ${studentId}`);
      return [];
    }

    // 2. student:<studentId>:student
    if (parts[0] === 'student' && (!parts[2] || parts[2] === 'student')) {
      const studentId = parts[1];
      const student = await (this.prisma as any).student.findFirst({
        where: { id: studentId, coachingId, deletedAt: null },
      });

      if (!student) {
        logger.warn(`[RecipientResolver] Student not found for token: ${recipientToken}`);
        return [];
      }

      return [
        {
          recipientId: student.id,
          phone: student.phone || undefined,
          email: student.email || undefined,
          name: `${student.firstName} ${student.lastName}`,
          recipientType: 'STUDENT',
        },
      ];
    }

    // 3. batch:<batchId>:students
    if (parts[0] === 'batch') {
      const batchId = parts[1];
      const enrollments = await (this.prisma as any).batchStudent.findMany({
        // batch_students has no deletedAt; exclude deleted students via the relation
        where: { batchId, coachingId, leftAt: null, student: { deletedAt: null } },
        include: {
          student: true,
        },
      });

      return enrollments
        .filter((e: any) => e.student && !e.student.deletedAt)
        .map((e: any) => ({
          recipientId: e.student.id,
          phone: e.student.phone || undefined,
          email: e.student.email || undefined,
          name: `${e.student.firstName} ${e.student.lastName}`,
          recipientType: 'STUDENT' as const,
        }));
    }

    // Fallback: unrecognized format, return as raw string
    return [
      {
        recipientId: recipientToken,
        phone: recipientToken,
        name: 'Direct',
        recipientType: 'PARENT',
      },
    ];
  }
}

export const recipientResolverService = RecipientResolverService.getInstance();
