import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportService } from '../../modules/reports/report.service.js';
import { IReportRepository, PrismaReportRepository } from '../../modules/reports/report.repository.js';
import { ReportMapper } from '../../modules/reports/report.mapper.js';
import { dateRange, timestampRange, todayInIndia } from '../../modules/reports/report.dates.js';
import { reportFilterSchema } from '../../modules/reports/validators/report.validator.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { REPORT_EVENTS } from '../../modules/reports/report.events.js';
import { money } from '../../common/money/money.js';
import { FeeInstallmentStatus } from '@trueco/types';

class InMemoryReportRepository implements IReportRepository {
  public feePlans: any[] = [];
  public feeInstallments: any[] = [];
  public attendanceSessions: any[] = [];
  public attendanceRecords: any[] = [];
  public pnl = { feeRevenue: money(0), salaryExpenses: money(0), generalExpenses: money(0) };

  public async getFeeData(): Promise<any> {
    return { plans: this.feePlans, installments: this.feeInstallments };
  }

  public async getAttendanceData(): Promise<any> {
    return { sessions: this.attendanceSessions, records: this.attendanceRecords };
  }

  public async getPnLData(): Promise<any> {
    return this.pnl;
  }
}

/** Some days from today in India (negative = past), as a date-only column stores it */
function dueIn(days: number): Date {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const rahul = {
  id: 's1',
  firstName: 'Rahul',
  lastName: 'Sharma',
  phone: '+919876543210',
  studentParents: [{ isPrimary: true, parent: { name: 'Suresh Sharma', phone: '+919876543211' } }],
};

describe('ReportService', () => {
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
      reportRepo.feePlans = [
        { id: 'p1', finalAmount: 20000 },
        { id: 'p2', finalAmount: 30000 },
      ];
      reportRepo.feeInstallments = [
        { amount: 10000, paidAmount: 5000, status: FeeInstallmentStatus.PARTIAL, dueDate: dueIn(-10), feePlan: { student: rahul } },
        { amount: 10000, paidAmount: 0, status: FeeInstallmentStatus.PENDING, dueDate: dueIn(20), feePlan: { student: rahul } },
        { amount: 30000, paidAmount: 20000, status: FeeInstallmentStatus.PARTIAL, dueDate: dueIn(5), feePlan: { student: { id: 's2' } } },
      ];

      const result = await reportService.generateFeeReport(testCoachingId, { format: 'csv' });

      expect(result.data.totalExpected).toBe(50000);
      expect(result.data.totalCollected).toBe(25000);
      expect(result.data.totalPending).toBe(25000);
      // Only the instalment already past its due date is overdue
      expect(result.data.totalOverdue).toBe(5000);
      expect(result.data.collectionPercentage).toBe(50);
      expect(result.data.defaulterCount).toBe(1);
      expect(result.data.defaulters[0]).toMatchObject({
        studentName: 'Rahul Sharma',
        parentName: 'Suresh Sharma',
        pendingAmount: 5000,
        overdueDays: 10,
      });
      expect(result.csv).toContain('"Student Name"');
      expect(result.csv).toContain('"Rahul Sharma"');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: REPORT_EVENTS.REPORT_GENERATED,
          payload: expect.objectContaining({ reportType: 'FEE_COLLECTION_REPORT', format: 'csv' }),
        }),
      );
    });

    it('does not count waived fees as pending or against the collection rate', async () => {
      reportRepo.feePlans = [{ id: 'p1', finalAmount: 20000 }];
      reportRepo.feeInstallments = [
        { amount: 10000, paidAmount: 10000, status: FeeInstallmentStatus.PAID, dueDate: dueIn(-40), feePlan: { student: rahul } },
        // Half paid, then the rest waived
        { amount: 10000, paidAmount: 4000, status: FeeInstallmentStatus.WAIVED, dueDate: dueIn(-10), feePlan: { student: rahul } },
      ];

      const { data } = await reportService.generateFeeReport(testCoachingId);

      expect(data.totalCollected).toBe(14000);
      expect(data.totalWaived).toBe(6000);
      expect(data.totalPending).toBe(0);
      expect(data.totalOverdue).toBe(0);
      expect(data.collectionPercentage).toBe(100);
      expect(data.defaulterCount).toBe(0);
    });

    it('adds up paise exactly and reports the oldest overdue date per student', async () => {
      reportRepo.feePlans = [{ id: 'p1', finalAmount: '3000.30' }];
      reportRepo.feeInstallments = [
        { amount: '1000.10', paidAmount: 0, status: FeeInstallmentStatus.OVERDUE, dueDate: dueIn(-30), feePlan: { student: rahul } },
        { amount: '1000.10', paidAmount: 0, status: FeeInstallmentStatus.PENDING, dueDate: dueIn(-1), feePlan: { student: rahul } },
        { amount: '1000.10', paidAmount: 0, status: FeeInstallmentStatus.PENDING, dueDate: dueIn(0), feePlan: { student: rahul } },
      ];

      const { data } = await reportService.generateFeeReport(testCoachingId);

      expect(data.totalPending).toBe(3000.3);
      // Due today is not overdue yet
      expect(data.totalOverdue).toBe(2000.2);
      expect(data.defaulters[0]!.pendingAmount).toBe(2000.2);
      expect(data.defaulters[0]!.overdueDays).toBe(30);
      expect(data.defaulters[0]!.installmentDueDate).toBe(dueIn(-30).toISOString().slice(0, 10));
    });

    it('has no collection rate when nothing is collectable', async () => {
      const { data } = await reportService.generateFeeReport(testCoachingId);
      expect(data.collectionPercentage).toBeNull();
    });
  });

  describe('generateAttendanceReport', () => {
    it('aggregates student percentages, lowest first, and flags defaulters below threshold', async () => {
      reportRepo.attendanceSessions = [{ id: 'ses-1' }, { id: 'ses-2' }, { id: 'ses-3' }, { id: 'ses-4' }];
      reportRepo.attendanceRecords = [
        ...['PRESENT', 'PRESENT', 'LATE', 'PRESENT'].map((status) => ({ studentId: 's1', status, student: { firstName: 'Aman' } })),
        ...['ABSENT', 'ABSENT', 'ABSENT', 'PRESENT'].map((status) => ({ studentId: 's2', status, student: { firstName: 'Rohan' } })),
      ];

      const { data } = await reportService.generateAttendanceReport(testCoachingId, { threshold: 75 });

      expect(data.totalSessions).toBe(4);
      expect(data.threshold).toBe(75);
      expect(data.students.map((s) => s.studentName)).toEqual(['Rohan', 'Aman']);
      expect(data.defaultersCount).toBe(1);
      expect(data.defaulters[0]).toMatchObject({ studentName: 'Rohan', percentage: 25 });
      expect(data.averageAttendancePercentage).toBe(62.5);
    });

    it('leaves excused absences out of the percentage', async () => {
      reportRepo.attendanceRecords = ['PRESENT', 'EXCUSED', 'EXCUSED', 'ABSENT'].map((status) => ({
        studentId: 's1',
        status,
        student: { firstName: 'Aman' },
      }));
      const { data } = await reportService.generateAttendanceReport(testCoachingId);
      expect(data.students[0]).toMatchObject({ totalClasses: 2, attendedClasses: 1, percentage: 50 });
    });

    it('has no average when nothing was marked', async () => {
      const { data } = await reportService.generateAttendanceReport(testCoachingId);
      expect(data.averageAttendancePercentage).toBeNull();
    });
  });

  describe('generateProfitLossReport', () => {
    it('computes net profit and margin exactly', async () => {
      reportRepo.pnl = {
        feeRevenue: money('100000.10'),
        salaryExpenses: money('40000.05'),
        generalExpenses: money('20000.05'),
      };

      const { data } = await reportService.generateProfitLossReport(testCoachingId);

      expect(data.totalRevenue).toBe(100000.1);
      expect(data.totalExpenses).toBe(60000.1);
      expect(data.netProfit).toBe(40000);
      expect(data.profitMarginPercentage).toBe(40);
    });

    it('shows a loss, and no margin without revenue', async () => {
      reportRepo.pnl = { feeRevenue: money(0), salaryExpenses: money(5000), generalExpenses: money(0) };
      const { data } = await reportService.generateProfitLossReport(testCoachingId);
      expect(data.netProfit).toBe(-5000);
      expect(data.profitMarginPercentage).toBeNull();
    });
  });
});

describe('report date ranges', () => {
  it('reads plain days as whole days in India for timestamps', () => {
    expect(timestampRange({ startDate: '2026-09-01', endDate: '2026-09-30' })).toEqual({
      gte: new Date('2026-08-31T18:30:00.000Z'),
      lt: new Date('2026-09-30T18:30:00.000Z'),
    });
    expect(timestampRange({})).toBeUndefined();
  });

  it('compares date-only columns by day, keeping both ends', () => {
    expect(dateRange({ startDate: '2026-09-01', endDate: '2026-09-30' })).toEqual({
      gte: new Date('2026-09-01T00:00:00.000Z'),
      lte: new Date('2026-09-30T00:00:00.000Z'),
    });
  });

  it('accepts days or exact times, but not a range that ends before it starts', () => {
    expect(reportFilterSchema.safeParse({ startDate: '2026-09-01', endDate: '2026-09-30' }).success).toBe(true);
    expect(reportFilterSchema.safeParse({ startDate: '2026-09-01T00:00:00+05:30' }).success).toBe(true);
    expect(reportFilterSchema.safeParse({ startDate: '2026-09-30', endDate: '2026-09-01' }).success).toBe(false);
    expect(reportFilterSchema.safeParse({ startDate: 'yesterday' }).success).toBe(false);
  });
});

describe('PrismaReportRepository', () => {
  it('applies both ends of a range (the end no longer replaces the start)', async () => {
    const where: Record<string, any> = {};
    const capture = (name: string) => ({
      findMany: async (args: any) => ((where[name] = args.where), []),
    });
    const prisma = {
      feeTransaction: capture('transactions'),
      salary: capture('salaries'),
      expense: capture('expenses'),
      attendanceSession: capture('sessions'),
      attendanceRecord: capture('records'),
    };
    const repo = new PrismaReportRepository(prisma as any);
    const range = { startDate: '2026-09-01', endDate: '2026-09-30' };

    await repo.getPnLData('c1', range);
    await repo.getAttendanceData('c1', 'b1', range);

    expect(where.transactions.paidAt).toEqual(timestampRange(range));
    expect(where.salaries.paidAt).toEqual(timestampRange(range));
    expect(where.expenses.expenseDate).toEqual(dateRange(range));
    expect(where.sessions).toMatchObject({ batchId: 'b1', sessionDate: dateRange(range) });
    expect(where.records.student).toEqual({ deletedAt: null });
  });
});

describe('ReportMapper.toCsv', () => {
  it('stops names from running as spreadsheet formulas', () => {
    const csv = ReportMapper.toCsv(
      [{ name: '=HYPERLINK("http://evil")', amount: -500 }],
      [
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount' },
      ],
    );
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    // Numbers, including negative ones, stay numbers
    expect(csv).toContain('"-500"');
  });
});
