import { IFeeRepository } from './fee.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { createFeeReminderTriggeredEvent } from './fee.events.js';
import { logger } from '../../common/logger/logger.service.js';

export class FeeReminderScheduler {
  public constructor(
    private readonly feeRepository: IFeeRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async runDailyReminderCheck(): Promise<number> {
    logger.info('[FeeReminderScheduler] Running daily scan for upcoming and overdue fee installments...');

    const now = new Date();
    // Scan installments due in the next 7 days or already overdue
    const scanThreshold = new Date(now);
    scanThreshold.setDate(scanThreshold.getDate() + 7);

    const pendingList = await this.feeRepository.findPendingInstallments(scanThreshold);
    let triggeredCount = 0;

    for (const inst of pendingList) {
      const dueDate = new Date(inst.dueDate);
      const diffMs = dueDate.getTime() - now.getTime();
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Trigger if 7 days before, 3 days before, due today, or overdue
      if (daysUntilDue === 7 || daysUntilDue === 3 || daysUntilDue === 0 || daysUntilDue < 0) {
        const studentId = inst.feePlan?.studentId;
        if (studentId) {
          const balance = Number(inst.amount) - Number(inst.paidAmount || 0);

          await this.eventBus.publish(
            createFeeReminderTriggeredEvent(
              {
                installmentId: inst.id,
                coachingId: inst.coachingId,
                studentId,
                amount: balance,
                dueDate,
                daysUntilDue,
              },
              crypto.randomUUID(),
            ),
          );
          triggeredCount++;
        }
      }
    }

    logger.info(`[FeeReminderScheduler] Daily reminder scan complete. Dispatched ${triggeredCount} reminder events.`);
    return triggeredCount;
  }
}
