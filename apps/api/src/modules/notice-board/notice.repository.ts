import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface CreateNoticeInput {
  coachingId: string;
  title: string;
  content: string;
  batchId?: string | null;
  targetAudience?: string;
  isPinned?: boolean;
  expiresAt?: Date | null;
  createdBy?: string;
}

export interface UpdateNoticeInput {
  title?: string;
  content?: string;
  batchId?: string | null;
  targetAudience?: string;
  isPinned?: boolean;
  expiresAt?: Date | null;
}

export interface NoticeFilterOptions {
  batchId?: string;
  targetAudience?: string;
  includeExpired?: boolean;
}

export interface INoticeRepository {
  create(input: CreateNoticeInput): Promise<any>;
  findById(id: string): Promise<any | null>;
  update(id: string, input: UpdateNoticeInput): Promise<any>;
  softDelete(id: string): Promise<void>;
  findMany(coachingId: string, filter?: NoticeFilterOptions): Promise<any[]>;
}

export class PrismaNoticeRepository implements INoticeRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async create(input: CreateNoticeInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notice.create({
      data: {
        coachingId: input.coachingId,
        title: input.title,
        content: input.content,
        batchId: input.batchId || null,
        targetAudience: input.targetAudience || 'ALL',
        isPinned: input.isPinned ?? false,
        expiresAt: input.expiresAt || null,
        createdBy: input.createdBy,
      },
      include: { batch: true },
    });
  }

  public async findById(id: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notice.findFirst({
      where: { id, deletedAt: null },
      include: { batch: true },
    });
  }

  public async update(id: string, input: UpdateNoticeInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notice.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.content !== undefined && { content: input.content }),
        ...(input.batchId !== undefined && { batchId: input.batchId }),
        ...(input.targetAudience !== undefined && { targetAudience: input.targetAudience }),
        ...(input.isPinned !== undefined && { isPinned: input.isPinned }),
        ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
      },
      include: { batch: true },
    });
  }

  public async softDelete(id: string): Promise<void> {
    const rawPrisma = this.prisma as any;
    await rawPrisma.notice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public async findMany(coachingId: string, filter?: NoticeFilterOptions): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    const now = new Date();

    return rawPrisma.notice.findMany({
      where: {
        coachingId,
        deletedAt: null,
        ...(filter?.batchId && {
          OR: [{ batchId: filter.batchId }, { batchId: null }],
        }),
        ...(filter?.targetAudience && {
          OR: [{ targetAudience: filter.targetAudience }, { targetAudience: 'ALL' }],
        }),
        ...(!filter?.includeExpired && {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        }),
      },
      include: { batch: true },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
