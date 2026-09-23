import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { logger } from '../common/logger/logger.service.js';
import { eventBus as defaultEventBus, EventBus } from '../events/event-bus.js';
import { runJobAsSystem } from './job-context.js';

const RELAY_EVERY_MS = 30_000;
const BATCH_SIZE = 100;

/**
 * Retries domain events whose handlers failed or were interrupted by a crash (see EventBus).
 * Runs in the worker process, which registers the same subscribers as the API.
 */
export class EventRelayWorker {
  private worker: Worker | null = null;

  public constructor(private readonly bus: EventBus = defaultEventBus) {}

  public async start(): Promise<Worker> {
    const queueRegistry = QueueRegistry.getInstance();
    const queue = queueRegistry.getQueue(QUEUE_NAMES.EVENTS);
    await queue.add('relay_due_events', {}, { jobId: 'relay_due_events', repeat: { every: RELAY_EVERY_MS } });

    this.worker = new Worker(
      QUEUE_NAMES.EVENTS,
      async (job: Job) =>
        runJobAsSystem(job, async () => {
          // Drain in batches so a backlog after an outage is cleared promptly
          let total = 0;
          for (let batch = await this.bus.redeliverDue(BATCH_SIZE); batch > 0; batch = await this.bus.redeliverDue(BATCH_SIZE)) {
            total += batch;
            if (batch < BATCH_SIZE) break;
          }
          if (total > 0) logger.info(`[EventRelayWorker] Redelivered ${total} event(s)`);
          return { redelivered: total };
        }),
      { connection: queueRegistry.getRedisClient(), concurrency: 1 },
    );

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[EventRelayWorker] Relay run ${job?.id} failed:`, err);
    });

    logger.info('[EventRelayWorker] Worker started listening to events-queue');
    return this.worker;
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
