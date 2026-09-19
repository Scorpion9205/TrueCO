import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { logger } from '../common/logger/logger.service.js';

export interface CleanupJobPayload {
  readonly dryRun?: boolean;
  readonly olderThanDays?: number;
}

export interface CleanupJobResult {
  readonly status: 'COMPLETED';
  readonly cleanedAt: string;
  readonly prunedCount: number;
}

export class CleanupWorker {
  private worker: Worker | null = null;

  public constructor(private readonly redisClient?: any) {}

  public async start(): Promise<Worker> {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = this.redisClient || queueRegistry.getRedisClient();

    // Register daily recurring cleanup job at 03:00 AM
    const cleanupQueue = queueRegistry.getQueue(QUEUE_NAMES.CLEANUP);
    await cleanupQueue.add(
      'daily_system_cleanup',
      { olderThanDays: 30 },
      {
        jobId: 'daily_system_cleanup',
        repeat: {
          pattern: '0 3 * * *', // Daily at 3:00 AM
        },
      },
    );

    this.worker = new Worker(
      QUEUE_NAMES.CLEANUP,
      async (job: Job<CleanupJobPayload>): Promise<CleanupJobResult> => {
        logger.info(`[CleanupWorker] Running system cleanup job: ${job.name} (id: ${job.id})`);
        return this.processJob(job.data);
      },
      {
        connection: redis,
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[CleanupWorker] Cleanup Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[CleanupWorker] Cleanup Job ${job?.id} failed:`, err);
    });

    logger.info('[CleanupWorker] Worker started listening to cleanup-queue');
    return this.worker;
  }

  public async processJob(_payload: CleanupJobPayload): Promise<CleanupJobResult> {
    const redis = this.redisClient || (process.env.NODE_ENV === 'test' ? null : QueueRegistry.getInstance().getRedisClient());
    let prunedCount = 0;

    // 1. Scan and purge expired OTP keys
    if (redis && typeof redis.keys === 'function') {
      try {
        const otpKeys = await redis.keys('otp:*');
        for (const key of otpKeys) {
          const ttl = await redis.ttl(key);
          if (ttl === -1) {
            // Key with no TTL, clean it up
            await redis.del(key);
            prunedCount++;
          }
        }
      } catch (err) {
        logger.warn('[CleanupWorker] Error inspecting OTP keys', { error: String(err) });
      }
    }

    logger.info(`[CleanupWorker] Cleanup completed. Pruned ${prunedCount} stale records.`);

    return {
      status: 'COMPLETED',
      cleanedAt: new Date().toISOString(),
      prunedCount,
    };
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
