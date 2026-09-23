import { IFeeRepository } from './fee.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { createFeeReminderTriggeredEvent } from './fee.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { money, toRupees } from '../../common/money/money.js';

/**
 * Days before (positive) or after (negative) the due date on which a reminder goes out. Each
 * stage is sent at most once per installment (the notification is keyed by stage), and
 * reminders stop after the last overdue stage.
 */
export const REMINDER_STAGE_DAYS = [7, 3, 0, -3, -7, -14] as const;

/** Local hour (in the coaching's time zone) at which reminders are sent. */
export const REMINDER_LOCAL_HOUR = 10;

const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
const PAGE_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export function reminderStage(daysUntilDue: number): string | null {
  if (!(REMINDER_STAGE_DAYS as readonly number[]).includes(daysUntilDue)) return null;
  if (daysUntilDue > 0) return `D-${daysUntilDue}`;
  return daysUntilDue === 0 ? 'D0' : `D+${-daysUntilDue}`;
}

function safeTimeZone(timeZone: string | null | undefined): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timeZone || DEFAULT_TIME_ZONE });
    return timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Calendar date ("YYYY-MM-DD") and hour at `now` in the given time zone. */
export function localDateAndHour(now: Date, timeZone: string): { date: string; hour: number } {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return { date, hour };
}

/** Whole days from the coaching's local today to a due date stored as a calendar date. */
export function daysBetween(localToday: string, dueDate: Date): number {
  const due = dueDate.toISOString().slice(0, 10);
  return Math.round((Date.parse(due) - Date.parse(localToday)) / DAY_MS);
}

export class FeeReminderScheduler {
  public constructor(
    private readonly feeRepository: IFeeRepository,
    private readonly eventBus: IEventBus,
  ) {}

  /**
   * Runs hourly. Each coaching is processed only in the hour when its local time is
   * REMINDER_LOCAL_HOUR, so parents are reminded in the morning of their own time zone.
   * Returns the number of reminders triggered.
   */
  public async runDailyReminderCheck(now: Date = new Date()): Promise<number> {
    let triggered = 0;
    let cursor: string | undefined;

    for (;;) {
      const coachings = await RequestContextService.runAsSystem('scheduler:fee-reminders', () =>
        this.feeRepository.listCoachingsForReminders(cursor, PAGE_SIZE),
      );
      for (const coaching of coachings) {
        const timeZone = safeTimeZone(coaching.timezone);
        const local = localDateAndHour(now, timeZone);
        if (local.hour !== REMINDER_LOCAL_HOUR) continue;

        try {
          triggered += await RequestContextService.runForTenant(coaching.id, () =>
            this.remindCoaching(coaching.id, local.date),
          );
        } catch (err) {
          // One coaching's failure must not stop reminders for the others
          logger.error(`[FeeReminderScheduler] Reminders failed for coaching ${coaching.id}`, err);
        }
      }
      if (coachings.length < PAGE_SIZE) break;
      cursor = coachings[coachings.length - 1].id;
    }

    if (triggered > 0) logger.info(`[FeeReminderScheduler] Triggered ${triggered} fee reminder(s)`);
    return triggered;
  }

  private async remindCoaching(coachingId: string, localToday: string): Promise<number> {
    const today = new Date(`${localToday}T00:00:00Z`);
    const from = new Date(today.getTime() + Math.min(...REMINDER_STAGE_DAYS) * DAY_MS);
    const to = new Date(today.getTime() + Math.max(...REMINDER_STAGE_DAYS) * DAY_MS);

    let triggered = 0;
    let cursor: string | undefined;
    for (;;) {
      const installments = await this.feeRepository.findInstallmentsDueBetween(from, to, cursor, PAGE_SIZE);
      for (const inst of installments) {
        const daysUntilDue = daysBetween(localToday, new Date(inst.dueDate));
        const stage = reminderStage(daysUntilDue);
        const studentId = inst.feePlan?.studentId;
        if (!stage || !studentId) continue;

        await this.eventBus.publish(
          createFeeReminderTriggeredEvent(
            {
              installmentId: inst.id,
              coachingId,
              studentId,
              amount: toRupees(money(inst.amount).minus(money(inst.paidAmount))),
              dueDate: new Date(inst.dueDate),
              daysUntilDue,
              stage,
            },
            crypto.randomUUID(),
          ),
        );
        triggered++;
      }
      if (installments.length < PAGE_SIZE) break;
      cursor = installments[installments.length - 1].id;
    }
    return triggered;
  }
}
