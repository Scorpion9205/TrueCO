import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { NotificationChannel, NotificationStatus } from '@trueco/types';

export interface CreateNotificationHistoryInput {
  coachingId: string;
  channel: NotificationChannel;
  recipient: string;
  recipientType: string;
  templateName?: string;
  content: string;
  idempotencyKey: string;
}

export interface UpdateNotificationStatusInput {
  providerMessageId?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface INotificationRepository {
  createHistory(input: CreateNotificationHistoryInput): Promise<any>;
  updateStatus(idempotencyKey: string, status: NotificationStatus, data?: UpdateNotificationStatusInput): Promise<any>;
  updateStatusByProviderId(providerMessageId: string, status: NotificationStatus, data?: UpdateNotificationStatusInput): Promise<any>;
  findFailed(coachingId: string, limit?: number, offset?: number): Promise<any[]>;
  findById(id: string): Promise<any | null>;
  findByIdempotencyKey(key: string): Promise<any | null>;
  /**
   * Atomically claims a notification for sending (QUEUED/FAILED -> SENDING, or a SENDING claim
   * abandoned by a crashed worker). Only the caller that gets true may send it.
   */
  claimForSending(idempotencyKey: string): Promise<boolean>;
}

// A worker that crashed after claiming leaves SENDING behind; after this long another may retry it
const SENDING_CLAIM_STALE_MS = 10 * 60 * 1000;

export class PrismaNotificationRepository implements INotificationRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async createHistory(input: CreateNotificationHistoryInput): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notificationHistory.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        coachingId: input.coachingId,
        channel: input.channel,
        recipient: input.recipient,
        recipientType: input.recipientType,
        templateName: input.templateName,
        content: input.content,
        idempotencyKey: input.idempotencyKey,
        status: NotificationStatus.QUEUED,
      },
      update: {}, // keep existing state if already queued
    });
  }

  public async updateStatus(
    idempotencyKey: string,
    status: NotificationStatus,
    data?: UpdateNotificationStatusInput,
  ): Promise<any> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notificationHistory.update({
      where: { idempotencyKey },
      data: {
        status,
        ...(data?.providerMessageId && { providerMessageId: data.providerMessageId }),
        ...(data?.errorMessage && { errorMessage: data.errorMessage }),
        ...(data?.sentAt && { sentAt: data.sentAt }),
        ...(data?.deliveredAt && { deliveredAt: data.deliveredAt }),
        ...(data?.readAt && { readAt: data.readAt }),
      },
    });
  }

  public async updateStatusByProviderId(
    providerMessageId: string,
    status: NotificationStatus,
    data?: UpdateNotificationStatusInput,
  ): Promise<any> {
    const rawPrisma = this.prisma as any;
    const existing = await rawPrisma.notificationHistory.findFirst({
      where: { providerMessageId },
    });

    if (!existing) return null;

    return rawPrisma.notificationHistory.update({
      where: { id: existing.id },
      data: {
        status,
        ...(data?.errorMessage && { errorMessage: data.errorMessage }),
        ...(data?.deliveredAt && { deliveredAt: data.deliveredAt }),
        ...(data?.readAt && { readAt: data.readAt }),
      },
    });
  }

  public async findFailed(coachingId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notificationHistory.findMany({
      where: { coachingId, status: NotificationStatus.FAILED },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  public async findById(id: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notificationHistory.findFirst({
      where: { id },
    });
  }

  public async claimForSending(idempotencyKey: string): Promise<boolean> {
    const rawPrisma = this.prisma as any;
    const staleBefore = new Date(Date.now() - SENDING_CLAIM_STALE_MS);
    const { count } = await rawPrisma.notificationHistory.updateMany({
      where: {
        idempotencyKey,
        OR: [
          { status: { in: [NotificationStatus.QUEUED, NotificationStatus.FAILED] } },
          { status: NotificationStatus.SENDING, updatedAt: { lt: staleBefore } },
        ],
      },
      data: { status: NotificationStatus.SENDING },
    });
    return count === 1;
  }

  public async findByIdempotencyKey(key: string): Promise<any | null> {
    const rawPrisma = this.prisma as any;
    return rawPrisma.notificationHistory.findUnique({
      where: { idempotencyKey: key },
    });
  }
}
