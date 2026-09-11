import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeeReminderScheduler } from '../../modules/fees/fee.cron.js';
import { IFeeRepository } from '../../modules/fees/fee.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { FEE_EVENTS } from '../../modules/fees/fee.events.js';
import { FeeInstallmentStatus } from '@trueco/types';

describe('FeeReminderScheduler (Phase 4 Cron Unit Tests)', () => {
  let scheduler: FeeReminderScheduler;
  let mockFeeRepo: Partial<IFeeRepository>;
  let mockEventBus: IEventBus;

  const testCoachingId = '11111111-1111-1111-1111-111111111111';
  const testStudentId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
  });

  it('scans and triggers reminders for installments due in 7 days, 3 days, today, or overdue', async () => {
    const now = new Date();

    const dueIn7Days = new Date(now);
    dueIn7Days.setDate(dueIn7Days.getDate() + 7);

    const dueIn3Days = new Date(now);
    dueIn3Days.setDate(dueIn3Days.getDate() + 3);

    const dueToday = new Date(now);

    const overdue = new Date(now);
    overdue.setDate(overdue.getDate() - 2);

    const dueIn15Days = new Date(now);
    dueIn15Days.setDate(dueIn15Days.getDate() + 15);

    const pendingInstallments = [
      {
        id: 'inst-7d',
        coachingId: testCoachingId,
        amount: 5000,
        paidAmount: 0,
        dueDate: dueIn7Days,
        status: FeeInstallmentStatus.PENDING,
        feePlan: { studentId: testStudentId },
      },
      {
        id: 'inst-3d',
        coachingId: testCoachingId,
        amount: 4000,
        paidAmount: 1000, // 3000 balance
        dueDate: dueIn3Days,
        status: FeeInstallmentStatus.PARTIAL,
        feePlan: { studentId: testStudentId },
      },
      {
        id: 'inst-today',
        coachingId: testCoachingId,
        amount: 2500,
        paidAmount: 0,
        dueDate: dueToday,
        status: FeeInstallmentStatus.PENDING,
        feePlan: { studentId: testStudentId },
      },
      {
        id: 'inst-overdue',
        coachingId: testCoachingId,
        amount: 3000,
        paidAmount: 0,
        dueDate: overdue,
        status: FeeInstallmentStatus.OVERDUE,
        feePlan: { studentId: testStudentId },
      },
      {
        id: 'inst-15d',
        coachingId: testCoachingId,
        amount: 6000,
        paidAmount: 0,
        dueDate: dueIn15Days,
        status: FeeInstallmentStatus.PENDING,
        feePlan: { studentId: testStudentId },
      },
    ];

    mockFeeRepo = {
      findPendingInstallments: vi.fn().mockResolvedValue(pendingInstallments),
    };

    scheduler = new FeeReminderScheduler(mockFeeRepo as IFeeRepository, mockEventBus);

    const count = await scheduler.runDailyReminderCheck();

    // 4 reminders should be triggered (7d, 3d, today, overdue), 15d ignored
    expect(count).toBe(4);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(4);

    // Verify partial balance computation on inst-3d
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: FEE_EVENTS.FEE_REMINDER_TRIGGERED,
        payload: expect.objectContaining({
          installmentId: 'inst-3d',
          amount: 3000, // 4000 - 1000
          daysUntilDue: 3,
        }),
      }),
    );
  });
});
