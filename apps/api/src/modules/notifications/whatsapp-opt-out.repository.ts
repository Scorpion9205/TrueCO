import {
  ExtendedPrismaClient,
  getPrismaClient,
} from '../../database/prisma/tenant-prisma.extension.js';

/** Last 10 digits, so "+91 98765-43210" and "9876543210" are the same person */
export function optOutKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

/** Phones that replied STOP to Vargly's WhatsApp number */
export class WhatsAppOptOutRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async optOut(phone: string): Promise<void> {
    const key = optOutKey(phone);
    await (this.prisma as any).whatsAppOptOut.upsert({
      where: { phone: key },
      create: { phone: key },
      update: {},
    });
  }

  public async optIn(phone: string): Promise<void> {
    await (this.prisma as any).whatsAppOptOut.deleteMany({ where: { phone: optOutKey(phone) } });
  }

  /** Which of these phones have opted out (as opt-out keys) */
  public async findOptedOut(phones: string[]): Promise<Set<string>> {
    if (phones.length === 0) return new Set();
    const rows: Array<{ phone: string }> = await (this.prisma as any).whatsAppOptOut.findMany({
      where: { phone: { in: [...new Set(phones.map(optOutKey))] } },
      select: { phone: true },
    });
    return new Set(rows.map((row) => row.phone));
  }
}

export const whatsAppOptOuts = new WhatsAppOptOutRepository();
