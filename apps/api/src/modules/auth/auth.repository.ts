import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { UserAggregate } from './auth.mapper.js';

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  family: string;
  isRevoked: boolean;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface IAuthUserRepository {
  findByEmail(email: string, coachingCode?: string): Promise<UserAggregate | null>;
  findById(id: string): Promise<UserAggregate | null>;
  updateLastLogin(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

export interface IRefreshTokenRepository {
  create(token: {
    userId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<StoredRefreshToken>;
  findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  revoke(id: string): Promise<void>;
  revokeFamily(family: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export class PrismaAuthUserRepository implements IAuthUserRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async findByEmail(email: string, coachingCode?: string): Promise<UserAggregate | null> {
    // Email is only unique per coaching. Without a coaching code, an email registered at
    // several institutes is ambiguous and must not resolve to an arbitrary tenant's account.
    const users = await (this.prisma as any).user.findMany({
      take: 2,
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
        ...(coachingCode ? { coaching: { code: coachingCode.trim() } } : {}),
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (users.length !== 1) return null;
    return users[0] as UserAggregate;
  }

  public async findById(id: string): Promise<UserAggregate | null> {
    const user = await (this.prisma as any).user.findFirst({
      where: { id, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return user as UserAggregate | null;
  }

  public async updateLastLogin(userId: string): Promise<void> {
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async create(data: {
    userId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<StoredRefreshToken> {
    const record = await (this.prisma as any).refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        family: data.family,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });
    return record as StoredRefreshToken;
  }

  public async findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const record = await (this.prisma as any).refreshToken.findUnique({
      where: { tokenHash },
    });
    return record as StoredRefreshToken | null;
  }

  public async revoke(id: string): Promise<void> {
    await (this.prisma as any).refreshToken.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  public async revokeFamily(family: string): Promise<void> {
    await (this.prisma as any).refreshToken.updateMany({
      where: { family },
      data: { isRevoked: true },
    });
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    await (this.prisma as any).refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }
}
