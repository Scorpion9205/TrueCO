import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  daysBetween,
  FeeReminderScheduler,
  localDateAndHour,
  reminderStage,
} from '../../modules/fees/fee.cron.js';
import { IFeeRepository } from '../../modules/fees/fee.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { FEE_EVENTS } from '../../modules/fees/fee.events.js';
import { FeeInstallmentStatus } from '@trueco/types';

const IST = '11111111-1111-1111-1111-111111111111';
const LONDON = '33333333-3333-3333-3333-333333333333';
const STUDENT = '22222222-2222-2222-2222-222222222222';

// 10:00 in Asia/Kolkata (UTC+5:30) is 04:30 UTC
const IST_10AM = new Date('2026-09-24T04:30:00Z');

function installment(id: string, dueDate: string, paid = 0) {
  return {
    id,
    amount: 1000,
    paidAmount: paid,
    dueDate: new Date(`${dueDate}T00:00:00Z`),
    status: paid ? FeeInstallmentStatus.PARTIAL : FeeInstallmentStatus.PENDING,
    feePlan: { studentId: STUDENT },
  };
}

describe('Fee reminder stages and time zones', () => {
  it('maps days-until-due to one-off stages and nothing in between', () => {
    expect([7, 3, 0, -3, -7, -14].map(reminderStage)).toEqual(['D-7', 'D-3', 'D0', 'D+3', 'D+7', 'D+14']);
    expect([6, 1, -1, -2, -15, -30].map(reminderStage)).toEqual([null, null, null, null, null, null]);
  });

  it('computes the local date and hour in the coaching time zone', () => {
    expect(localDateAndHour(IST_10AM, 'Asia/Kolkata')).toEqual({ date: '2026-09-24', hour: 10 });
    // Just before midnight UTC it is already the next day in India
    expect(localDateAndHour(new Date('2026-09-24T20:00:00Z'), 'Asia/Kolkata').date).toBe('2026-09-25');
  });

  it('counts whole calendar days to the due date', () => {
    expect(daysBetween('2026-09-24', new Date('2026-10-01T00:00:00Z'))).toBe(7);
    expect(daysBetween('2026-09-24', new Date('2026-09-21T00:00:00Z'))).toBe(-3);
  });
});

describe('FeeReminderScheduler', () => {
  let mockEventBus: IEventBus;
  let repo: Pick<IFeeRepository, 'listCoachingsForReminders' | 'findInstallmentsDueBetween'>;

  beforeEach(() => {
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    repo = {
      listCoachingsForReminders: vi.fn().mockResolvedValue([
        { id: IST, timezone: 'Asia/Kolkata' },
        { id: LONDON, timezone: 'Europe/London' },
      ]),
      findInstallmentsDueBetween: vi.fn().mockResolvedValue([
        installment('due-in-7', '2026-10-01'),
        installment('due-in-5', '2026-09-29'),
        installment('due-today', '2026-09-24', 400),
        installment('overdue-3', '2026-09-21'),
        installment('overdue-2', '2026-09-22'),
      ]),
    };
  });

  const scheduler = () => new FeeReminderScheduler(repo as IFeeRepository, mockEventBus);
  const published = () => (mockEventBus.publish as any).mock.calls.map((c: any[]) => c[0]);

  it('reminds only on stage days, with the stage and outstanding balance', async () => {
    const count = await scheduler().runDailyReminderCheck(IST_10AM);

    expect(count).toBe(3);
    const events = published();
    expect(events.map((e: any) => [e.payload.installmentId, e.payload.stage])).toEqual([
      ['due-in-7', 'D-7'],
      ['due-today', 'D0'],
      ['overdue-3', 'D+3'],
    ]);
    expect(events[1]).toMatchObject({
      eventName: FEE_EVENTS.FEE_REMINDER_TRIGGERED,
      coachingId: IST,
      payload: { amount: 600, daysUntilDue: 0 },
    });
  });

  it('processes a coaching only at 10:00 in its own time zone', async () => {
    await scheduler().runDailyReminderCheck(IST_10AM);
    // It is 05:30 in London at that moment: only the Indian coaching was scanned
    expect(repo.findInstallmentsDueBetween).toHaveBeenCalledTimes(1);

    (repo.findInstallmentsDueBetween as any).mockClear();
    await scheduler().runDailyReminderCheck(new Date('2026-09-24T12:00:00Z'));
    expect(repo.findInstallmentsDueBetween).not.toHaveBeenCalled();
  });

  it('pages through coachings instead of loading every tenant at once', async () => {
    const page = (start: number, size: number) =>
      Array.from({ length: size }, (_, i) => ({ id: `c-${String(start + i).padStart(4, '0')}`, timezone: 'Asia/Kolkata' }));
    repo.listCoachingsForReminders = vi
      .fn()
      .mockResolvedValueOnce(page(0, 200))
      .mockResolvedValueOnce(page(200, 10));
    repo.findInstallmentsDueBetween = vi.fn().mockResolvedValue([]);

    await scheduler().runDailyReminderCheck(IST_10AM);
    expect(repo.listCoachingsForReminders).toHaveBeenNthCalledWith(1, undefined, 200);
    expect(repo.listCoachingsForReminders).toHaveBeenNthCalledWith(2, 'c-0199', 200);
    expect(repo.findInstallmentsDueBetween).toHaveBeenCalledTimes(210);
  });
});
