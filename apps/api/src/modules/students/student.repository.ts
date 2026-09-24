import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { StudentListFilters } from './dto/student.dto.js';

// Name order, with id breaking ties so pages never repeat or skip a student
const LIST_ORDER = [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }];

export interface IStudentRepository {
  create(data: any): Promise<any>;
  findById(id: string): Promise<any | null>;
  findMany(filters?: StudentListFilters): Promise<any[]>;
  findPage(
    filters: StudentListFilters,
    page: number,
    limit: number,
  ): Promise<{ rows: any[]; total: number }>;
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

  public async findMany(filters?: StudentListFilters): Promise<any[]> {
    return (this.prisma as any).student.findMany({
      where: this.listWhere(filters),
      orderBy: LIST_ORDER,
    });
  }

  public async findPage(
    filters: StudentListFilters,
    page: number,
    limit: number,
  ): Promise<{ rows: any[]; total: number }> {
    const where = this.listWhere(filters);
    const [rows, total] = await Promise.all([
      (this.prisma as any).student.findMany({
        where,
        orderBy: LIST_ORDER,
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).student.count({ where }),
    ]);
    return { rows, total };
  }

  private listWhere(filters?: StudentListFilters): any {
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
    return where;
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
