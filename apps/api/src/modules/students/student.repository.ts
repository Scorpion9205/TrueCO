import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface IStudentRepository {
  create(data: any): Promise<any>;
  findById(id: string): Promise<any | null>;
  findMany(filters?: { isActive?: boolean; search?: string }): Promise<any[]>;
  update(id: string, data: any): Promise<any>;
  softDelete(id: string): Promise<void>;
}

export class PrismaStudentRepository implements IStudentRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async create(data: any): Promise<any> {
    return (this.prisma as any).student.create({ data });
  }

  public async findById(id: string): Promise<any | null> {
    return (this.prisma as any).student.findFirst({
      where: { id, deletedAt: null },
      include: {
        studentParents: { include: { parent: true } },
        batchStudents: { include: { batch: true } },
      },
    });
  }

  public async findMany(filters?: { isActive?: boolean; search?: string }): Promise<any[]> {
    const where: any = { deletedAt: null };
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { rollNumber: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
      ];
    }

    return (this.prisma as any).student.findMany({
      where,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  public async update(id: string, data: any): Promise<any> {
    return (this.prisma as any).student.update({
      where: { id },
      data,
    });
  }

  public async softDelete(id: string): Promise<void> {
    await (this.prisma as any).student.delete({
      where: { id },
    });
  }
}
