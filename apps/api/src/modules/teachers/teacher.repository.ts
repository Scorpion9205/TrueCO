import {
  getPrismaClient,
  ExtendedPrismaClient,
} from '../../database/prisma/tenant-prisma.extension.js';
import { RoleType } from '@vargly/types';

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
  /** Whether any account in this coaching (deleted ones too) already signs in with this email */
  emailInUse(email: string): Promise<boolean>;
  /** Updates the profile and keeps the teacher's login account's name and phone in step */
  update(id: string, data: any): Promise<any>;
}

const WITH_BATCHES = {
  teacherBatches: { where: { batch: { deletedAt: null } }, include: { batch: true } },
} as const;

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
        include: WITH_BATCHES,
      });

      return teacher;
    });
  }

  public async findById(id: string): Promise<any | null> {
    return (this.prisma as any).teacher.findFirst({
      where: { id, deletedAt: null },
      include: WITH_BATCHES,
    });
  }

  public async findByUserId(userId: string): Promise<any | null> {
    return (this.prisma as any).teacher.findFirst({
      where: { userId, deletedAt: null },
      include: WITH_BATCHES,
    });
  }

  public async findByPhone(phone: string): Promise<any | null> {
    return (this.prisma as any).teacher.findFirst({
      where: { phone: phone.trim(), deletedAt: null },
      include: WITH_BATCHES,
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
      include: WITH_BATCHES,
      orderBy: { name: 'asc' },
    });
  }

  public async emailInUse(email: string): Promise<boolean> {
    // The unique index covers deleted accounts too, so they count as taken
    const user = await (this.prisma as any).user.findFirst({
      where: { email: email.toLowerCase().trim() },
      select: { id: true },
    });
    return Boolean(user);
  }

  public async update(id: string, data: any): Promise<any> {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const teacher = await tx.teacher.update({ where: { id }, data, include: WITH_BATCHES });
      if (data.name !== undefined || data.phone !== undefined) {
        await tx.user.update({
          where: { id: teacher.userId },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
          },
        });
      }
      return teacher;
    });
  }
}
