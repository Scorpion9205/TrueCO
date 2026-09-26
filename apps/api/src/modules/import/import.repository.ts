import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';
import type { BatchImportRow, StudentImportRow } from './validators/import.validator.js';

export interface IImportRepository {
  /** Lower-cased active batch names -> ids, to check and link a row's batch */
  findBatchIdsByName(coachingId: string): Promise<Map<string, string>>;
  /** All or nothing: the rows are written in one transaction */
  importStudents(coachingId: string, rows: StudentImportRow[]): Promise<string[]>;
  importBatches(coachingId: string, rows: BatchImportRow[]): Promise<string[]>;
}

/** Up to 1000 rows with parents and enrolments; generous, but a hung import still ends */
const TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 10_000 };

export class PrismaImportRepository implements IImportRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async findBatchIdsByName(coachingId: string): Promise<Map<string, string>> {
    const batches = await (this.prisma as any).batch.findMany({
      where: { coachingId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    });
    return new Map(batches.map((b: { id: string; name: string }) => [b.name.toLowerCase().trim(), b.id]));
  }

  public async importStudents(coachingId: string, rows: StudentImportRow[]): Promise<string[]> {
    const batchIds = await this.findBatchIdsByName(coachingId);

    return (this.prisma as any).$transaction(async (tx: any) => {
      const importedIds: string[] = [];
      // Parents already known, or created earlier in this file (siblings share one parent)
      const parentIds = new Map<string, string>();

      for (const row of rows) {
        const student = await tx.student.create({
          data: {
            coachingId,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone ?? null,
            email: row.email?.toLowerCase() ?? null,
            rollNumber: row.rollNumber ?? null,
            gender: row.gender ?? null,
            dob: row.dob ? new Date(`${row.dob}T00:00:00Z`) : null,
            ...(row.joiningDate ? { joiningDate: new Date(`${row.joiningDate}T00:00:00Z`) } : {}),
          },
          select: { id: true },
        });
        importedIds.push(student.id);

        if (row.parentName && row.parentPhone) {
          let parentId = parentIds.get(row.parentPhone);
          if (!parentId) {
            const existing = await tx.parent.findFirst({
              where: { coachingId, phone: row.parentPhone, deletedAt: null },
              select: { id: true },
            });
            parentId =
              existing?.id ??
              (
                await tx.parent.create({
                  data: {
                    coachingId,
                    name: row.parentName,
                    phone: row.parentPhone,
                    relation: row.parentRelation,
                  },
                  select: { id: true },
                })
              ).id;
            parentIds.set(row.parentPhone, parentId!);
          }
          await tx.studentParent.create({
            data: { coachingId, studentId: student.id, parentId, isPrimary: true },
          });
        }

        const batchId = row.batchName ? batchIds.get(row.batchName.toLowerCase().trim()) : undefined;
        if (batchId) {
          await tx.batchStudent.create({
            data: { coachingId, batchId, studentId: student.id, joinedAt: new Date() },
          });
        }
      }
      return importedIds;
    }, TRANSACTION_OPTIONS);
  }

  public async importBatches(coachingId: string, rows: BatchImportRow[]): Promise<string[]> {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const importedIds: string[] = [];
      for (const row of rows) {
        const days = row.daysOfWeek
          ? row.daysOfWeek
              .split(',')
              .map((d) => d.trim().toUpperCase())
              .filter(Boolean)
          : [];
        const batch = await tx.batch.create({
          data: {
            coachingId,
            name: row.name,
            subject: row.subject ?? null,
            academicYear: row.academicYear,
            startTime: row.startTime ?? null,
            endTime: row.endTime ?? null,
            daysOfWeek: days,
          },
          select: { id: true },
        });
        importedIds.push(batch.id);
      }
      return importedIds;
    }, TRANSACTION_OPTIONS);
  }
}
