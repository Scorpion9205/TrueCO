import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportService } from '../../modules/reports/report.service.js';
import { IReportRepository } from '../../modules/reports/report.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { REPORT_EVENTS } from '../../modules/reports/report.events.js';
import { FeeInstallmentStatus } from '@trueco/types';

class InMemoryReportRepository implements IReportRepository {
  public feePlans: any[] = [];
  public feeInstallments: any[] = [];
  public feeTransactions: any[] = [];
  public attendanceSessions: any[] = [];
  public attendanceRecords: any[] = [];
  public pnl = { feeRevenue: 0, salaryExpenses: 0, generalExpenses: 0 };

  public async getFeeData(_coachingId: string): Promise<any> {
    return {
      plans: this.feePlans,
      installments: this.feeInstallments,
      transactions: this.feeTransactions,
    };
  }

  public async getAttendanceData(_coachingId: string, _batchId?: string): Promise<any> {
    return {
      sessions: this.attendanceSessions,
      records: this.attendanceRecords,
    };
  }

  public async getPnLData(_coachingId: string): Promise<any> {
    return this.pnl;
  }
}

describe('ReportService (Phase 5 Reports Unit Tests)', () => {
  let reportService: ReportService;
  let reportRepo: InMemoryReportRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    reportRepo = new InMemoryReportRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    reportService = new ReportService(reportRepo, mockEventBus);
  });

  describe('generateFeeReport', () => {
    it('calculates totals, identifies overdue defaulters, and produces CSV export', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      reportRepo.feePlans = [
        { id: 'p1', finalAmount: 20000 },
        { id: 'p2', finalAmount: 30000 },
      ];
      reportRepo.feeTransactions = [
        { amount: 15000 },
        { amount: 10000 },
      ]; // total collected: 25000 / 50000 (50%)

      reportRepo.feeInstallments = [
        {
          id: 'inst-1',
          amount: 10000,
          paidAmount: 5000,
          status: FeeInstallmentStatus.PARTIAL,
          dueDate: pastDate,
          feePlan: {
            student: {
              id: 's1',
              firstName: 'Rahul',
              lastName: 'Sharma',
              phone: '+919876543210',
              studentParents: [
                { parent: { firstName: 'Suresh', lastName: 'Sharma', phone: '+919876543211' } },
              ],
            },
          },
        },
      ];

      const result = await reportService.generateFeeReport(testCoachingId, { format: 'csv' });

      expect(result.data.totalExpected).toBe(50000);
      expect(result.data.totalCollected).toBe(25000);
      expect(result.data.totalPending).toBe(25000);
      expect(result.data.collectionPercentage).toBe(50);
      expect(result.data.defaulterCount).toBe(1);
      expect(result.data.defaulters[0].studentName).toBe('Rahul Sharma');
      expect(result.data.defaulters[0].pendingAmount).toBe(5000);

      // Verify CSV content contains headers and student row
      expect(result.csv).toBeDefined();
      expect(result.csv).toContain('"Student Name"');
      expect(result.csv).toContain('"Rahul Sharma"');

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: REPORT_EVENTS.REPORT_GENERATED,
          payload: expect.objectContaining({
            reportType: 'FEE_COLLECTION_REPORT',
            format: 'csv',
          }),
        }),
      );
    });
  });

  describe('generateAttendanceReport', () => {
    it('aggregates student percentages and flags defaulters below threshold', async () => {
      reportRepo.attendanceSessions = [{ id: 'ses-1' }, { id: 'ses-2' }, { id: 'ses-3' }, { id: 'ses-4' }];
      reportRepo.attendanceRecords = [
        // s1 attended 4/4 = 100%
        { studentId: 's1', status: 'PRESENT', student: { firstName: 'Aman' } },
        { studentId: 's1', status: 'PRESENT', student: { firstName: 'Aman' } },
        { studentId: 's1', status: 'PRESENT', student: { firstName: 'Aman' } },
        { studentId: 's1', status: 'PRESENT', student: { firstName: 'Aman' } },
        // s2 attended 1/4 = 25% (defaulter)
        { studentId: 's2', status: 'ABSENT', student: { firstName: 'Rohan' } },
        { studentId: 's2', status: 'ABSENT', student: { firstName: 'Rohan' } },
        { studentId: 's2', status: 'ABSENT', student: { firstName: 'Rohan' } },
        { studentId: 's2', status: 'PRESENT', student: { firstName: 'Rohan' } },
      ];

      const result = await reportService.generateAttendanceReport(testCoachingId, { threshold: 75 });

      expect(result.data.totalSessions).toBe(4);
      expect(result.data.students.length).toBe(2);
      expect(result.data.defaultersCount).toBe(1);
      expect(result.data.defaulters[0].studentName).toBe('Rohan');
      expect(result.data.defaulters[0].percentage).toBe(25);
    });
  });

  describe('generateProfitLossReport', () => {
    it('computes net margin accurately based on revenues and expenses', async () => {
      reportRepo.pnl = {
        feeRevenue: 100000,
        salaryExpenses: 40000,
        generalExpenses: 20000,
      };

      const result = await reportService.generateProfitLossReport(testCoachingId);

      expect(result.data.totalRevenue).toBe(100000);
      expect(result.data.totalExpenses).toBe(60000);
      expect(result.data.netProfit).toBe(40000);
      expect(result.data.profitMarginPercentage).toBe(40);
    });
  });
});
