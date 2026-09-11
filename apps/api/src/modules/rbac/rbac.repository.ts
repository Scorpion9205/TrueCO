import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface IRbacRepository {
  findRoles(coachingId?: string): Promise<any[]>;
  findRoleByCode(code: string, coachingId?: string): Promise<any | null>;
  findPermissions(): Promise<any[]>;
  assignRole(userId: string, roleId: string, coachingId: string): Promise<any>;
  findUserRoles(userId: string, coachingId: string): Promise<any[]>;
}

export class PrismaRbacRepository implements IRbacRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async findRoles(coachingId?: string): Promise<any[]> {
    return (this.prisma as any).role.findMany({
      where: {
        OR: [
          { isSystem: true, coachingId: null },
          ...(coachingId ? [{ coachingId }] : []),
        ],
        deletedAt: null,
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  public async findRoleByCode(code: string, coachingId?: string): Promise<any | null> {
    return (this.prisma as any).role.findFirst({
      where: {
        code,
        OR: [
          { isSystem: true, coachingId: null },
          ...(coachingId ? [{ coachingId }] : []),
        ],
        deletedAt: null,
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  public async findPermissions(): Promise<any[]> {
    return (this.prisma as any).permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }

  public async assignRole(userId: string, roleId: string, coachingId: string): Promise<any> {
    return (this.prisma as any).userRole.upsert({
      where: {
        userId_roleId_coachingId: {
          userId,
          roleId,
          coachingId,
        },
      },
      create: {
        userId,
        roleId,
        coachingId,
      },
      update: {},
    });
  }

  public async findUserRoles(userId: string, coachingId: string): Promise<any[]> {
    return (this.prisma as any).userRole.findMany({
      where: {
        userId,
        coachingId,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
  }
}
