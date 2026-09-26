import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportService, normaliseColumns } from '../../modules/import/import.service.js';
import { IImportRepository, PrismaImportRepository } from '../../modules/import/import.repository.js';
import { bulkImportSchema, MAX_IMPORT_ROWS } from '../../modules/import/validators/import.validator.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { IMPORT_EVENTS } from '../../modules/import/import.events.js';

class InMemoryImportRepository implements IImportRepository {
  public students: any[] = [];
  public batches: any[] = [];
  public batchNames = new Map<string, string>([['batch a', 'b1']]);

  public async findBatchIdsByName(): Promise<Map<string, string>> {
    return this.batchNames;
  }

  public async importStudents(_coachingId: string, rows: any[]): Promise<string[]> {
    this.students.push(...rows);
    return rows.map((_r, idx) => `student-${idx + 1}`);
  }

  public async importBatches(_coachingId: string, rows: any[]): Promise<string[]> {
    this.batches.push(...rows);
    return rows.map((_r, idx) => `batch-${idx + 1}`);
  }
}

describe('ImportService', () => {
  let importService: ImportService;
  let importRepo: InMemoryImportRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    importRepo = new InMemoryImportRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    importService = new ImportService(importRepo, mockEventBus);
  });

  it('validates students row by row, skips invalid rows and imports the rest', async () => {
    const result = await importService.importData(
      {
        entityType: 'STUDENTS',
        rows: [
          {
            'First Name': 'Ankit',
            'Last Name': 'Sharma',
            Mobile: '98765 43210',
            'Roll No.': 'A-12',
            Gender: 'male',
            'Date of Birth': '2011-05-31',
            'Parent Name': 'Ramesh Sharma',
            'Parent Phone': '98765-43211',
            Relation: 'father',
            Batch: 'Batch A',
          },
          { firstName: 'Invalid', lastName: 'Student', phone: 'bad-phone' },
          { firstName: 'No', lastName: 'Batch', batchName: 'Batch Z' },
          { firstName: 'Half', lastName: 'Parent', parentName: 'Only A Name' },
        ],
        dryRun: false,
      },
      testCoachingId,
      testUserId,
    );

    expect(result.successCount).toBe(1);
    expect(result.errors.map((e) => [e.rowNumber, e.field])).toEqual([
      [2, 'phone'],
      [3, 'batchName'],
      [4, 'parentPhone'],
    ]);
    expect(importRepo.students).toEqual([
      expect.objectContaining({
        firstName: 'Ankit',
        phone: '9876543210',
        rollNumber: 'A-12',
        gender: 'MALE',
        dob: '2011-05-31',
        parentPhone: '9876543211',
        parentRelation: 'FATHER',
        batchName: 'Batch A',
      }),
    ]);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: IMPORT_EVENTS.BULK_DATA_IMPORTED,
        payload: expect.objectContaining({ successCount: 1, errorCount: 3, dryRun: false }),
      }),
    );
  });

  it('checks everything in a dry run without saving', async () => {
    const result = await importService.importData(
      { entityType: 'STUDENTS', rows: [{ firstName: 'Riya', lastName: 'Verma' }], dryRun: true },
      testCoachingId,
    );
    expect(result).toMatchObject({ successCount: 1, errorCount: 0, dryRun: true, importedIds: [] });
    expect(importRepo.students).toEqual([]);
  });

  it('imports batches with their days', async () => {
    const result = await importService.importData(
      {
        entityType: 'BATCHES',
        rows: [{ Name: 'Target JEE 2027', 'Academic Year': '2026-27', Days: 'MON, WED,FRI' }],
        dryRun: false,
      },
      testCoachingId,
    );
    expect(result.successCount).toBe(1);
    expect(importRepo.batches[0]).toMatchObject({ name: 'Target JEE 2027', daysOfWeek: 'MON, WED,FRI' });
  });

  it('refuses teacher imports and oversized files', () => {
    expect(bulkImportSchema.safeParse({ entityType: 'TEACHERS', rows: [{}] }).success).toBe(false);
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({}));
    expect(bulkImportSchema.safeParse({ entityType: 'STUDENTS', rows }).success).toBe(false);
  });

  it('matches column headings however they are written', () => {
    // The first matching column wins; unknown columns are ignored
    expect(
      normaliseColumns({ 'ROLL NO': '1', roll_number: '2', 'e-mail': 'x', Notes: 'ignored' }),
    ).toEqual({ rollNumber: '1', email: 'x' });
  });
});

describe('PrismaImportRepository', () => {
  function fakePrisma() {
    const writes: Array<{ model: string; data: any }> = [];
    let transactions = 0;
    const model = (name: string) => ({
      create: async (args: any) => {
        writes.push({ model: name, data: args.data });
        return { id: `${name}-${writes.length}` };
      },
      findFirst: async () => null,
      findMany: async () => [{ id: 'b1', name: 'Batch A' }],
    });
    const tx = {
      student: model('student'),
      parent: model('parent'),
      studentParent: model('studentParent'),
      batchStudent: model('batchStudent'),
      batch: model('batch'),
    };
    const prisma = {
      ...tx,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
        transactions += 1;
        return fn(tx);
      },
    };
    return { prisma, writes, transactions: () => transactions };
  }

  it('writes students with the real column names, in one transaction', async () => {
    const { prisma, writes, transactions } = fakePrisma();
    const row = {
      firstName: 'Ankit',
      lastName: 'Sharma',
      rollNumber: 'A-12',
      gender: 'MALE' as const,
      dob: '2011-05-31',
      parentName: 'Ramesh Sharma',
      parentPhone: '9876543211',
      parentRelation: 'FATHER' as const,
      batchName: 'batch a',
    };
    // Two siblings share one parent
    await new PrismaImportRepository(prisma as any).importStudents('c1', [
      row,
      { ...row, firstName: 'Diya' },
    ]);

    expect(transactions()).toBe(1);
    const student = writes.find((w) => w.model === 'student')!.data;
    expect(student).toMatchObject({ rollNumber: 'A-12', gender: 'MALE', dob: new Date('2011-05-31T00:00:00Z') });
    expect(student).not.toHaveProperty('rollNo');
    expect(writes.filter((w) => w.model === 'parent')).toEqual([
      { model: 'parent', data: { coachingId: 'c1', name: 'Ramesh Sharma', phone: '9876543211', relation: 'FATHER' } },
    ]);
    expect(writes.filter((w) => w.model === 'studentParent')).toHaveLength(2);
    expect(writes.filter((w) => w.model === 'batchStudent')).toHaveLength(2);
  });
});
