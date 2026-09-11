import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface CreateTimelineEntryInput {
  coachingId: string;
  studentId: string;
  eventType: string;
  summary: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface ITimelineRepository {
  create(input: CreateTimelineEntryInput): Promise<any>;
  findByStudent(
    studentId: string,
    options?: { limit?: number; offset?: number; eventType?: string },
  ): Promise<any[]>;
}

export class PrismaTimelineRepository implements ITimelineRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async create(input: CreateTimelineEntryInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.studentTimeline.create({
      data: {
        coachingId: input.coachingId,
        studentId: input.studentId,
        eventType: input.eventType,
        summary: input.summary,
        referenceId: input.referenceId,
        metadata: input.metadata || {},
        occurredAt: input.occurredAt || new Date(),
      },
    });
  }

  public async findByStudent(
    studentId: string,
    options?: { limit?: number; offset?: number; eventType?: string },
  ): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.studentTimeline.findMany({
      where: {
        studentId,
        ...(options?.eventType && { eventType: options.eventType }),
      },
      orderBy: { occurredAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }
}
