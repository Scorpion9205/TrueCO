import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface CreateAuditLogInput {
  coachingId: string;
  userId?: string;
  action: string;
  entityName: string;
  entityId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilterOptions {
  entityName?: string;
  action?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface IAuditRepository {
  create(input: CreateAuditLogInput): Promise<any>;
  findMany(coachingId: string, options?: AuditLogFilterOptions): Promise<any[]>;
}

export class PrismaAuditRepository implements IAuditRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async create(input: CreateAuditLogInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.auditLog.create({
      data: {
        coachingId: input.coachingId,
        userId: input.userId,
        action: input.action,
        entityName: input.entityName,
        entityId: input.entityId,
        beforeState: input.beforeState || null,
        afterState: input.afterState || null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  public async findMany(coachingId: string, options?: AuditLogFilterOptions): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.auditLog.findMany({
      where: {
        coachingId,
        ...(options?.entityName && { entityName: options.entityName }),
        ...(options?.action && { action: options.action }),
        ...(options?.userId && { userId: options.userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }
}
