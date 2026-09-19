import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfWorker } from '../../workers/pdf.worker.js';
import { ReportWorker } from '../../workers/report.worker.js';
import { ImportWorker } from '../../workers/import.worker.js';
import { AnalyticsWorker } from '../../workers/analytics.worker.js';
import { MockStorageService } from '../../common/storage/mock-storage.service.js';

describe('Background Workers Unit Tests (Phase 3)', () => {
  describe('PdfWorker', () => {
    let pdfWorker: PdfWorker;
    let mockStorage: MockStorageService;

    beforeEach(() => {
      mockStorage = new MockStorageService();
      pdfWorker = new PdfWorker(mockStorage);
    });

    it('should generate valid PDF buffer with %PDF magic header for FEE_RECEIPT', async () => {
      const buffer = await pdfWorker.renderPdfBuffer({
        coachingId: 'coaching-1',
        type: 'FEE_RECEIPT',
        referenceId: 'rec-123',
        metadata: {
          coachingName: 'Apex Academy',
          studentName: 'Aarav Sharma',
          amount: 5000,
          remainingBalance: 0,
        },
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
    });

    it('should process FEE_RECEIPT job and upload to storage', async () => {
      const result = await pdfWorker.processJob({
        coachingId: 'coaching-1',
        type: 'FEE_RECEIPT',
        referenceId: 'rec-123',
        metadata: {
          studentName: 'Aarav Sharma',
          amount: 5000,
        },
      });

      expect(result.status).toBe('GENERATED');
      expect(result.documentUrl).toContain('/api/v1/storage/files/coaching-1/receipt/');
      expect(result.sizeBytes).toBeGreaterThan(100);
    });

    it('should generate valid PDF for STUDENT_REPORT', async () => {
      const result = await pdfWorker.processJob({
        coachingId: 'coaching-1',
        type: 'STUDENT_REPORT',
        referenceId: 'stu-99',
        metadata: {
          studentName: 'Priya Patel',
          attendancePercentage: 92,
          averageTestScore: 88,
        },
      });

      expect(result.status).toBe('GENERATED');
      expect(result.documentUrl).toContain('/api/v1/storage/files/coaching-1/report/');
    });

    it('should generate valid PDF for SALARY_SLIP', async () => {
      const result = await pdfWorker.processJob({
        coachingId: 'coaching-1',
        type: 'SALARY_SLIP',
        referenceId: 'sal-555',
        metadata: {
          teacherName: 'Dr. Verma',
          baseSalary: 45000,
        },
      });

      expect(result.status).toBe('GENERATED');
      expect(result.documentUrl).toContain('/api/v1/storage/files/coaching-1/general/');
    });
  });

  describe('ReportWorker', () => {
    let reportWorker: ReportWorker;
    let mockStorage: MockStorageService;

    beforeEach(() => {
      mockStorage = new MockStorageService();
      reportWorker = new ReportWorker(mockStorage);
    });

    it('should compile ATTENDANCE report as XLSX and upload to storage', async () => {
      const result = await reportWorker.processJob({
        coachingId: 'coaching-1',
        reportType: 'ATTENDANCE',
        filter: { batchId: 'b-1' },
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.format).toBe('xlsx');
      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.reportUrl).toContain('/api/v1/storage/files/coaching-1/report/');
    });

    it('should compile FEES report as XLSX and upload to storage', async () => {
      const result = await reportWorker.processJob({
        coachingId: 'coaching-1',
        reportType: 'FEES',
        filter: {},
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.format).toBe('xlsx');
      expect(result.reportUrl).toBeDefined();
    });

    it('should compile PROFIT_LOSS statement as XLSX', async () => {
      const result = await reportWorker.processJob({
        coachingId: 'coaching-1',
        reportType: 'PROFIT_LOSS',
        filter: {},
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.format).toBe('xlsx');
    });
  });

  describe('ImportWorker', () => {
    it('should validate and process bulk student rows reporting errors for invalid rows', async () => {
      const mockPrisma: any = {
        student: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            if (!data.firstName) throw new Error('First name required');
            return { id: 's-1', ...data };
          }),
        },
      };

      const worker = new ImportWorker(mockPrisma);

      const result = await worker.processJob({
        coachingId: 'coaching-1',
        entityType: 'STUDENTS',
        rows: [
          { firstName: 'Rahul', lastName: 'Kumar', phone: '9876543210' },
          { firstName: '', lastName: 'MissingFirst' }, // Invalid
          { firstName: 'Sneha', lastName: 'Gupta' },
        ],
      });

      expect(result.status).toBe('PARTIAL_SUCCESS');
      expect(result.processedCount).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.errors[0].row).toBe(2);
    });
  });

  describe('AnalyticsWorker', () => {
    it('should aggregate student, teacher, and batch counts and write to redis', async () => {
      const mockPrisma: any = {
        student: { count: vi.fn().mockResolvedValue(150) },
        teacher: { count: vi.fn().mockResolvedValue(12) },
        batch: { count: vi.fn().mockResolvedValue(8) },
      };
      const mockRedis: any = {
        set: vi.fn().mockResolvedValue('OK'),
      };

      const worker = new AnalyticsWorker(mockPrisma, mockRedis);
      const result = await worker.processJob({ coachingId: 'coaching-1' });

      expect(result.activeStudentsCount).toBe(150);
      expect(result.activeTeachersCount).toBe(12);
      expect(result.activeBatchesCount).toBe(8);
      expect(result.computedAt).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'analytics:coaching-1:summary',
        expect.any(String),
        'EX',
        3600,
      );
    });
  });

  describe('CleanupWorker', () => {
    it('should scan and purge expired keys', async () => {
      const { CleanupWorker } = await import('../../workers/cleanup.worker.js');
      const mockRedis: any = {
        keys: vi.fn().mockResolvedValue(['otp:1', 'otp:2']),
        ttl: vi.fn().mockImplementation((k) => (k === 'otp:1' ? -1 : 300)),
        del: vi.fn().mockResolvedValue(1),
      };

      const worker = new CleanupWorker(mockRedis);
      const result = await worker.processJob({});

      expect(result.status).toBe('COMPLETED');
      expect(result.prunedCount).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('otp:1');
    });
  });
});
