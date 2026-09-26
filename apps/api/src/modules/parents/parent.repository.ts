import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface IParentRepository {
  create(data: any): Promise<any>;
  findByPhone(phone: string): Promise<any | null>;
  /** batchIds limits the lookup to parents of students in those batches (a teacher's) */
  findById(id: string, batchIds?: string[]): Promise<any | null>;
  linkStudent(data: { studentId: string; parentId: string; coachingId: string; isPrimary?: boolean }): Promise<any>;
  findMany(search?: string, batchIds?: string[]): Promise<any[]>;
}

/** Parents with a child currently in one of the batches; no condition when batchIds is absent */
function inBatches(batchIds?: string[]) {
  return batchIds
    ? {
        studentParents: {
          some: { student: { batchStudents: { some: { batchId: { in: batchIds }, leftAt: null } } } },
        },
      }
    : {};
}

export class PrismaParentRepository implements IParentRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async create(data: any): Promise<any> {
    return (this.prisma as any).parent.create({
      data,
      include: {
        studentParents: {
          include: { student: true },
        },
      },
    });
  }

  public async findByPhone(phone: string): Promise<any | null> {
    return (this.prisma as any).parent.findFirst({
      where: { phone: phone.trim(), deletedAt: null },
      include: {
        studentParents: {
          include: { student: true },
        },
      },
    });
  }

  public async findById(id: string, batchIds?: string[]): Promise<any | null> {
    return (this.prisma as any).parent.findFirst({
      where: { id, deletedAt: null, ...inBatches(batchIds) },
      include: {
        studentParents: {
          include: { student: true },
        },
      },
    });
  }

  public async linkStudent(data: {
    studentId: string;
    parentId: string;
    coachingId: string;
    isPrimary?: boolean;
  }): Promise<any> {
    return (this.prisma as any).studentParent.upsert({
      where: {
        studentId_parentId: {
          studentId: data.studentId,
          parentId: data.parentId,
        },
      },
      create: {
        studentId: data.studentId,
        parentId: data.parentId,
        coachingId: data.coachingId,
        isPrimary: data.isPrimary ?? true,
      },
      update: {
        isPrimary: data.isPrimary ?? true,
      },
    });
  }

  public async findMany(search?: string, batchIds?: string[]): Promise<any[]> {
    const where: any = { deletedAt: null, ...inBatches(batchIds) };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    return (this.prisma as any).parent.findMany({
      where,
      include: {
        studentParents: {
          include: { student: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
