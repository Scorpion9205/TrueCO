import { getPrismaClient, ExtendedPrismaClient } from '../../database/prisma/tenant-prisma.extension.js';

export interface IImportRepository {
  importStudents(coachingId: string, rows: any[]): Promise<string[]>;
  importTeachers(coachingId: string, rows: any[]): Promise<string[]>;
  importBatches(coachingId: string, rows: any[]): Promise<string[]>;
}

export class PrismaImportRepository implements IImportRepository {
  public constructor(private readonly prisma: ExtendedPrismaClient = getPrismaClient()) {}

  public async importStudents(coachingId: string, rows: any[]): Promise<string[]> {
    const rawPrisma = this.prisma as any;
    const importedIds: string[] = [];

    // Pre-fetch batches for caching batch lookups by name
    const existingBatches = await rawPrisma.batch.findMany({
      where: { coachingId, deletedAt: null },
    });
    const batchMap = new Map<string, string>(
      existingBatches.map((b: any) => [b.name.toLowerCase().trim(), b.id]),
    );

    for (const row of rows) {
      const student = await rawPrisma.student.create({
        data: {
          coachingId,
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone,
          email: row.email || null,
          rollNo: row.rollNo || null,
          gender: row.gender || null,
          dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
        },
      });
      importedIds.push(student.id);

      // Handle Parent creation and linking if parent info provided
      if (row.parentName || row.parentPhone) {
        const pNames = (row.parentName || 'Parent').trim().split(' ');
        const pFirst = pNames[0];
        const pLast = pNames.slice(1).join(' ') || 'Parent';
        const pPhone = row.parentPhone || row.phone;

        let parent = await rawPrisma.parent.findFirst({
          where: { coachingId, phone: pPhone },
        });

        if (!parent) {
          parent = await rawPrisma.parent.create({
            data: {
              coachingId,
              firstName: pFirst,
              lastName: pLast,
              phone: pPhone,
            },
          });
        }

        await rawPrisma.studentParent.create({
          data: {
            coachingId,
            studentId: student.id,
            parentId: parent.id,
            relation: row.parentRelation || 'PARENT',
            isPrimary: true,
          },
        });
      }

      // Handle Batch enrollment if batchName provided
      if (row.batchName) {
        const bId = batchMap.get(row.batchName.toLowerCase().trim());
        if (bId) {
          await rawPrisma.batchStudent.create({
            data: {
              coachingId,
              batchId: bId,
              studentId: student.id,
              joinedAt: new Date(),
            },
          });
        }
      }
    }

    return importedIds;
  }

  public async importTeachers(coachingId: string, rows: any[]): Promise<string[]> {
    const rawPrisma = this.prisma as any;
    const importedIds: string[] = [];

    for (const row of rows) {
      const teacher = await rawPrisma.teacher.create({
        data: {
          coachingId,
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone,
          email: row.email || null,
          subject: row.subject || null,
          monthlySalary: row.monthlySalary || null,
        },
      });
      importedIds.push(teacher.id);
    }

    return importedIds;
  }

  public async importBatches(coachingId: string, rows: any[]): Promise<string[]> {
    const rawPrisma = this.prisma as any;
    const importedIds: string[] = [];

    for (const row of rows) {
      const days = row.daysOfWeek
        ? row.daysOfWeek.split(',').map((d: string) => d.trim().toUpperCase())
        : [];

      const batch = await rawPrisma.batch.create({
        data: {
          coachingId,
          name: row.name,
          subject: row.subject || null,
          academicYear: row.academicYear,
          startTime: row.startTime || null,
          endTime: row.endTime || null,
          daysOfWeek: days,
        },
      });
      importedIds.push(batch.id);
    }

    return importedIds;
  }
}
