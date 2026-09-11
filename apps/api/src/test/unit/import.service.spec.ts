import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportService } from '../../modules/import/import.service.js';
import { IImportRepository } from '../../modules/import/import.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { IMPORT_EVENTS } from '../../modules/import/import.events.js';

class InMemoryImportRepository implements IImportRepository {
  public students: any[] = [];
  public teachers: any[] = [];
  public batches: any[] = [];

  public async importStudents(_coachingId: string, rows: any[]): Promise<string[]> {
    const ids = rows.map((_r, idx) => `student-${idx + 1}`);
    this.students.push(...rows);
    return ids;
  }

  public async importTeachers(_coachingId: string, rows: any[]): Promise<string[]> {
    const ids = rows.map((_r, idx) => `teacher-${idx + 1}`);
    this.teachers.push(...rows);
    return ids;
  }

  public async importBatches(_coachingId: string, rows: any[]): Promise<string[]> {
    const ids = rows.map((_r, idx) => `batch-${idx + 1}`);
    this.batches.push(...rows);
    return ids;
  }
}

describe('ImportService (Phase 5 Bulk Import Unit Tests)', () => {
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

  describe('importData', () => {
    it('validates students row-by-row, isolates invalid rows, and imports valid rows', async () => {
      const rows = [
        {
          firstName: 'Ankit',
          lastName: 'Sharma',
          phone: '+919876543210',
          email: 'ankit@example.com',
          parentName: 'Ramesh Sharma',
          parentPhone: '+919876543211',
          batchName: 'Batch A',
        },
        {
          firstName: 'Invalid',
          lastName: 'Student',
          phone: 'bad-phone', // Invalid phone format
        },
      ];

      const result = await importService.importData(
        {
          entityType: 'STUDENTS',
          rows,
          dryRun: false,
        },
        testCoachingId,
        testUserId,
      );

      expect(result.totalRows).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].rowNumber).toBe(2);
      expect(result.errors[0].field).toBe('phone');
      expect(result.importedIds.length).toBe(1);
      expect(importRepo.students.length).toBe(1);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: IMPORT_EVENTS.BULK_DATA_IMPORTED,
          payload: expect.objectContaining({
            coachingId: testCoachingId,
            entityType: 'STUDENTS',
            successCount: 1,
            errorCount: 1,
            dryRun: false,
          }),
        }),
      );
    });

    it('executes in dryRun mode without persisting rows to database', async () => {
      const rows = [
        {
          firstName: 'Dr. APJ',
          lastName: 'Kalam',
          phone: '+919876543222',
          subject: 'Aerospace Engineering',
          monthlySalary: 75000,
        },
      ];

      const result = await importService.importData(
        {
          entityType: 'TEACHERS',
          rows,
          dryRun: true,
        },
        testCoachingId,
        testUserId,
      );

      expect(result.totalRows).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.dryRun).toBe(true);
      expect(result.importedIds.length).toBe(0);
      // DB repo was not touched
      expect(importRepo.teachers.length).toBe(0);
    });

    it('successfully validates batch import format with comma-separated days', async () => {
      const rows = [
        {
          name: 'Target JEE 2027',
          subject: 'Mathematics',
          academicYear: '2026-2027',
          startTime: '16:00',
          endTime: '18:00',
          daysOfWeek: 'MON,WED,FRI',
        },
      ];

      const result = await importService.importData(
        {
          entityType: 'BATCHES',
          rows,
          dryRun: false,
        },
        testCoachingId,
        testUserId,
      );

      expect(result.successCount).toBe(1);
      expect(importRepo.batches.length).toBe(1);
    });
  });
});
