import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { getPrismaClient, ExtendedPrismaClient } from '../database/prisma/tenant-prisma.extension.js';
import { logger } from '../common/logger/logger.service.js';
import { runJobForTenant } from './job-context.js';

export interface AnalyticsJobPayload {
  readonly coachingId: string;
  readonly dateRange?: { from: string; to: string };
}

export interface CoachingAnalyticsSummary {
  readonly activeStudentsCount: number;
  readonly activeTeachersCount: number;
  readonly activeBatchesCount: number;
  readonly computedAt: string;
}

export class AnalyticsWorker {
  private worker: Worker | null = null;

  public constructor(
    private readonly prisma: ExtendedPrismaClient = getPrismaClient(),
    private readonly redisClient?: any,
  ) {}

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = this.redisClient || queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.ANALYTICS,
      async (job: Job<AnalyticsJobPayload>): Promise<CoachingAnalyticsSummary> => {
        logger.info(`[AnalyticsWorker] Computing analytics rollup for coaching ${job.data.coachingId}`);
        return runJobForTenant(job, () => this.processJob(job.data));
      },
      {
        connection: redis,
        concurrency: 2,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[AnalyticsWorker] Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[AnalyticsWorker] Job ${job?.id} failed:`, err);
    });

    logger.info('[AnalyticsWorker] Worker started listening to analytics-queue');
    return this.worker;
  }

  public async processJob(payload: AnalyticsJobPayload): Promise<CoachingAnalyticsSummary> {
    const rawPrisma = this.prisma as any;
    const { coachingId } = payload;

    const [activeStudentsCount, activeTeachersCount, activeBatchesCount] = await Promise.all([
      rawPrisma.student.count({
        where: { coachingId, deletedAt: null },
      }).catch(() => 0),
      rawPrisma.teacher.count({
        where: { coachingId, deletedAt: null },
      }).catch(() => 0),
      rawPrisma.batch.count({
        where: { coachingId, isActive: true, deletedAt: null },
      }).catch(() => 0),
    ]);

    const summary: CoachingAnalyticsSummary = {
      activeStudentsCount,
      activeTeachersCount,
      activeBatchesCount,
      computedAt: new Date().toISOString(),
    };

    // Cache summary in Redis if client is available and active
    const redis = this.redisClient || (process.env.NODE_ENV === 'test' ? null : QueueRegistry.getInstance().getRedisClient());
    if (redis && typeof redis.set === 'function') {
      try {
        await redis.set(
          `analytics:${coachingId}:summary`,
          JSON.stringify(summary),
          'EX',
          3600, // 1 hour TTL
        );
      } catch (cacheErr) {
        logger.warn('[AnalyticsWorker] Failed to cache summary in Redis', { error: String(cacheErr) });
      }
    }

    return summary;
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
