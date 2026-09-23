import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { FeeReminderScheduler } from '../modules/fees/fee.cron.js';
import { PrismaFeeRepository } from '../modules/fees/fee.repository.js';
import { eventBus } from '../events/event-bus.js';
import { logger } from '../common/logger/logger.service.js';
import { runJobAsSystem } from './job-context.js';

export class ReminderWorker {
  private worker: Worker | null = null;
  private readonly scheduler: FeeReminderScheduler;

  public constructor(
    scheduler?: FeeReminderScheduler,
  ) {
    this.scheduler = scheduler || new FeeReminderScheduler(new PrismaFeeRepository(), eventBus);
  }

  public async start(): Promise<Worker> {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    // Register daily scan job if not already scheduled
    const reminderQueue = queueRegistry.getQueue(QUEUE_NAMES.REMINDER);
    // Hourly: each coaching is reminded when it is 10:00 in its own time zone
    await reminderQueue
      .removeRepeatable('daily_fee_reminder_scan', { pattern: '0 8 * * *' }, 'daily_fee_reminder_scan')
      .catch(() => undefined);
    await reminderQueue.add(
      'hourly_fee_reminder_scan',
      {},
      {
        jobId: 'hourly_fee_reminder_scan',
        repeat: {
          pattern: '0 * * * *',
        },
      },
    );

    this.worker = new Worker(
      QUEUE_NAMES.REMINDER,
      async (job: Job) => {
        logger.info(`[ReminderWorker] Processing reminder job: ${job.name} (id: ${job.id})`);
        // Scans installments across all coachings; reminder events then run per tenant
        const count = await runJobAsSystem(job, () => this.scheduler.runDailyReminderCheck());
        return { triggeredCount: count };
      },
      {
        connection: redis,
        concurrency: 2,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[ReminderWorker] Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[ReminderWorker] Job ${job?.id} failed:`, err);
    });

    logger.info('[ReminderWorker] Worker started listening to reminder-queue');
    return this.worker;
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
