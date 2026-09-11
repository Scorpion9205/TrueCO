import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { RoleType } from '@trueco/types';

export interface CreateTeacherTransactionInput {
  coachingId: string;
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  specialization?: string;
  monthlySalary?: number;
  joiningDate: Date;
}

export interface ITeacherRepository {
  createWithUser(input: CreateTeacherTransactionInput): Promise<any>;
  findById(id: string): Promise<any | null>;
  findByUserId(userId: string): Promise<any | null>;
  findByPhone(phone: string): Promise<any | null>;
  findMany(filters?: { isActive?: boolean; search?: string }): Promise<any[]>;
  update(id: string, data: any): Promise<any>;
}

export class PrismaTeacherRepository implements ITeacherRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async createWithUser(input: CreateTeacherTransactionInput): Promise<any> {
    const rawPrisma = this.prisma as any;

    return rawPrisma.$transaction(async (tx: any) => {
      // 1. Create User account for Teacher
      const user = await tx.user.create({
        data: {
          coachingId: input.coachingId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          passwordHash: input.passwordHash,
        },
      });

      // 2. Ensure TEACHER role exists
      let teacherRole = await tx.role.findFirst({
        where: { code: RoleType.TEACHER },
      });

      if (!teacherRole) {
        teacherRole = await tx.role.create({
          data: {
            name: 'Teacher',
            code: RoleType.TEACHER,
            description: 'Faculty and instructors scoped to assigned batches',
            isSystem: true,
          },
        });
      }

      // 3. Assign role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: teacherRole.id,
          coachingId: input.coachingId,
        },
      });

      // 4. Create Teacher Profile
      const teacher = await tx.teacher.create({
        data: {
          coachingId: input.coachingId,
          userId: user.id,
          name: input.name,
          phone: input.phone,
          email: input.email,
          specialization: input.specialization,
          monthlySalary: input.monthlySalary,
          joiningDate: input.joiningDate,
        },
        include: {
          teacherBatches: { include: { batch: true } },
        },
      });

      return teacher;
    });
  }

  public async findById(id: string): Promise<any | null> {
    return (this.prisma as any).teacher.findFirst({
      where: { id, deletedAt: null },
      include: {
        teacherBatches: { include: { batch: true } },
      },
    });
  }

  public async findByUserId(userId: string): Promise<any | null> {
    return (this.prisma as any).teacher.findFirst({
      where: { userId, deletedAt: null },
      include: {
        teacherBatches: { include: { batch: true } },
      },
    });
  }

  public async findByPhone(phone: string): Promise<any | null> {
    return (this.prisma as any).teacher.findFirst({
      where: { phone: phone.trim(), deletedAt: null },
      include: {
        teacherBatches: { include: { batch: true } },
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
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return (this.prisma as any).teacher.findMany({
      where,
      include: {
        teacherBatches: { include: { batch: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  public async update(id: string, data: any): Promise<any> {
    return (this.prisma as any).teacher.update({
      where: { id },
      data,
      include: {
        teacherBatches: { include: { batch: true } },
      },
    });
  }
}
