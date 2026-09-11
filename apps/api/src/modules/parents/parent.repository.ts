import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface IParentRepository {
  create(data: any): Promise<any>;
  findByPhone(phone: string): Promise<any | null>;
  findById(id: string): Promise<any | null>;
  linkStudent(data: { studentId: string; parentId: string; coachingId: string; isPrimary?: boolean }): Promise<any>;
  findMany(search?: string): Promise<any[]>;
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

  public async findById(id: string): Promise<any | null> {
    return (this.prisma as any).parent.findFirst({
      where: { id, deletedAt: null },
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

  public async findMany(search?: string): Promise<any[]> {
    const where: any = { deletedAt: null };
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
