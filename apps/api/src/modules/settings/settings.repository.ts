import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface ISettingsRepository {
  findByCoachingId(coachingId: string): Promise<any | null>;
  upsert(coachingId: string, config: Record<string, unknown>): Promise<any>;
}

export class PrismaSettingsRepository implements ISettingsRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async findByCoachingId(coachingId: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.setting.findUnique({
      where: { coachingId },
    });
  }

  public async upsert(coachingId: string, config: Record<string, unknown>): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.setting.upsert({
      where: { coachingId },
      create: {
        coachingId,
        config,
      },
      update: {
        config,
      },
    });
  }
}
