import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from '../../modules/dashboard/dashboard.service.js';
import {
  IDashboardRepository,
  PrismaDashboardRepository,
} from '../../modules/dashboard/dashboard.repository.js';
import { todayInIndia } from '../../modules/reports/report.dates.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { DASHBOARD_EVENTS } from '../../modules/dashboard/dashboard.events.js';

class InMemoryDashboardRepository implements IDashboardRepository {
  public ownerData: any = {};
  public teacherData: any = {};

  public async getOwnerDashboardData(_coachingId: string): Promise<any> {
    return this.ownerData;
  }

  public async getTeacherDashboardData(_coachingId: string, _teacherId: string): Promise<any> {
    return this.teacherData;
  }
}

describe('DashboardService (Phase 5 Dashboard Unit Tests)', () => {
  let dashboardService: DashboardService;
  let dashboardRepo: InMemoryDashboardRepository;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testTeacherId = '22222222-2222-2222-2222-222222222222';
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    dashboardRepo = new InMemoryDashboardRepository();
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    dashboardService = new DashboardService(dashboardRepo, mockEventBus);
  });

  describe('getOwnerOverview', () => {
    it('aggregates institute-wide KPIs, recent activities, and upcoming installments', async () => {
      dashboardRepo.ownerData = {
        metrics: {
          totalStudents: 150,
          totalTeachers: 8,
          totalBatches: 6,
          monthlyRevenue: 240000,
          monthlyPendingFees: 60000,
          monthlyExpenses: 80000,
          todayAttendanceRate: 92.5,
          highRiskCount: 3,
        },
        recentActivities: [
          {
            id: 'act-1',
            student: { firstName: 'Priya', lastName: 'Patel' },
            eventType: 'FEE_PAID',
            summary: 'Paid installment #1 (₹5000)',
            occurredAt: new Date(),
          },
        ],
        upcomingInstallments: [
          {
            id: 'inst-1',
            feePlan: { student: { firstName: 'Vikas', lastName: 'Verma' } },
            amount: 7000,
            paidAmount: 0,
            dueDate: new Date(),
          },
        ],
      };

      const result = await dashboardService.getOwnerOverview(testCoachingId, testUserId);

      expect(result.metrics.totalStudents).toBe(150);
      expect(result.metrics.monthlyRevenue).toBe(240000);
      expect(result.recentActivities.length).toBe(1);
      expect(result.recentActivities[0].studentName).toBe('Priya Patel');
      expect(result.upcomingInstallments.length).toBe(1);
      expect(result.upcomingInstallments[0].amount).toBe(7000);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: DASHBOARD_EVENTS.DASHBOARD_VIEWED,
          payload: expect.objectContaining({
            coachingId: testCoachingId,
            portal: 'OWNER',
          }),
        }),
      );
    });
  });

  describe('getTeacherOverview', () => {
    it('retrieves assigned batches, sessions, and active homework count for teacher', async () => {
      dashboardRepo.teacherData = {
        assignedBatches: [
          {
            id: 'b-1',
            name: 'Batch 11-A',
            subject: 'Physics',
            batchStudents: [{}, {}, {}],
          },
        ],
        todaySessions: [
          {
            id: 's-1',
            batch: { name: 'Batch 11-A' },
            sessionDate: new Date(),
            records: [
              { status: 'PRESENT' },
              { status: 'PRESENT' },
              { status: 'ABSENT' },
            ],
          },
        ],
        activeHomeworkCount: 2,
      };

      const result = await dashboardService.getTeacherOverview(
        testCoachingId,
        testTeacherId,
        testUserId,
      );

      expect(result.assignedBatches.length).toBe(1);
      expect(result.assignedBatches[0].studentCount).toBe(3);
      expect(result.todaySessions.length).toBe(1);
      expect(result.todaySessions[0].presentCount).toBe(2);
      expect(result.todaySessions[0].totalCount).toBe(3);
      expect(result.activeHomeworkCount).toBe(2);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: DASHBOARD_EVENTS.DASHBOARD_VIEWED,
          payload: expect.objectContaining({
            coachingId: testCoachingId,
            portal: 'TEACHER',
          }),
        }),
      );
    });
  });
});

describe('PrismaDashboardRepository', () => {
  function fakePrisma(rows: Record<string, any[]>) {
    const where: Record<string, any> = {};
    const model = (name: string) => ({
      findMany: async (args: any) => ((where[name] = args.where), rows[name] ?? []),
      count: async () => 0,
    });
    const prisma: any = new Proxy({}, { get: (_t, name: string) => model(name) });
    return { prisma, where };
  }

  it('counts today by class date in India, leaves excused absences out and adds money exactly', async () => {
    const { prisma, where } = fakePrisma({
      feeTransaction: [{ amount: '1000.10' }, { amount: '2000.20' }],
      expense: [{ amount: '0.10' }, { amount: '0.20' }],
      feeInstallment: [{ amount: '1000.10', paidAmount: '0.05' }],
      attendanceRecord: [
        { status: 'PRESENT' },
        { status: 'LATE' },
        { status: 'ABSENT' },
        { status: 'EXCUSED' },
      ],
    });
    const data = await new PrismaDashboardRepository(prisma).getOwnerDashboardData('c1');

    expect(data.metrics.monthlyRevenue).toBe(3000.3);
    expect(data.metrics.monthlyExpenses).toBe(0.3);
    expect(data.metrics.monthlyPendingFees).toBe(1000.05);
    // 2 of 3 counted records (the excused one is left out)
    expect(data.metrics.todayAttendanceRate).toBe(66.67);

    const today = todayInIndia();
    expect(where.attendanceRecord.session.sessionDate).toEqual(new Date(`${today}T00:00:00Z`));
    expect(where.feeTransaction.paidAt.gte).toEqual(new Date(`${today.slice(0, 7)}-01T00:00:00+05:30`));
    expect(where.feeInstallment.feePlan).toEqual({ deletedAt: null, student: { deletedAt: null } });
  });

  it("leaves deleted batches out of a teacher's list and looks at today's classes only", async () => {
    const { prisma, where } = fakePrisma({ teacherBatch: [] });
    await new PrismaDashboardRepository(prisma).getTeacherDashboardData('c1', 't1');
    expect(where.teacherBatch.batch).toEqual({ deletedAt: null });
    expect(where.attendanceSession).toMatchObject({
      deletedAt: null,
      sessionDate: new Date(`${todayInIndia()}T00:00:00Z`),
    });
  });
});
