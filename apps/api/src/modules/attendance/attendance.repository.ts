import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import { AttendanceStatus } from '@trueco/types';

export interface UpsertAttendanceSessionInput {
  coachingId: string;
  batchId: string;
  sessionDate: Date;
  slot?: string;
  markedById?: string;
  remarks?: string;
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    remarks?: string;
  }>;
}

export interface IAttendanceRepository {
  upsertSessionWithRecords(input: UpsertAttendanceSessionInput): Promise<any>;
  findSessionById(id: string): Promise<any | null>;
  findSessionsByBatch(batchId: string, startDate?: Date, endDate?: Date): Promise<any[]>;
}

export class PrismaAttendanceRepository implements IAttendanceRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async upsertSessionWithRecords(input: UpsertAttendanceSessionInput): Promise<any> {
    const rawPrisma = this.prisma as any;

    return rawPrisma.$transaction(async (tx: any) => {
      // 1. Upsert AttendanceSession for batch + date
      const session = await tx.attendanceSession.upsert({
        where: {
          coachingId_batchId_sessionDate: {
            coachingId: input.coachingId,
            batchId: input.batchId,
            sessionDate: input.sessionDate,
          },
        },
        create: {
          coachingId: input.coachingId,
          batchId: input.batchId,
          sessionDate: input.sessionDate,
          slot: input.slot,
          markedById: input.markedById,
          remarks: input.remarks,
        },
        update: {
          slot: input.slot,
          markedById: input.markedById,
          remarks: input.remarks,
        },
      });

      // 2. Upsert AttendanceRecords for each student
      for (const record of input.records) {
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: record.studentId,
            },
          },
          create: {
            coachingId: input.coachingId,
            sessionId: session.id,
            studentId: record.studentId,
            status: record.status,
            remarks: record.remarks,
          },
          update: {
            status: record.status,
            remarks: record.remarks,
          },
        });
      }

      // Return complete session with relations
      return tx.attendanceSession.findUnique({
        where: { id: session.id },
        include: {
          records: {
            include: { student: true },
          },
        },
      });
    });
  }

  public async findSessionById(id: string): Promise<any | null> {
    return (this.prisma as any).attendanceSession.findFirst({
      where: { id, deletedAt: null },
      include: {
        records: {
          include: { student: true },
        },
      },
    });
  }

  public async findSessionsByBatch(batchId: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    const where: any = { batchId, deletedAt: null };
    if (startDate || endDate) {
      where.sessionDate = {};
      if (startDate) where.sessionDate.gte = startDate;
      if (endDate) where.sessionDate.lte = endDate;
    }

    return (this.prisma as any).attendanceSession.findMany({
      where,
      include: {
        records: {
          include: { student: true },
        },
      },
      orderBy: { sessionDate: 'desc' },
    });
  }
}
