import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { AiService } from '../modules/ai/ai.service.js';
import { PrismaAiRepository } from '../modules/ai/ai.repository.js';
import { AiProviderFactory } from '../modules/ai/providers/ai-provider.factory.js';
import { RedisPromptCache } from '../modules/ai/cache/redis-prompt.cache.js';
import { eventBus } from '../events/event-bus.js';
import { AiGenerationJobPayload } from '../modules/ai/ai.jobs.js';
import { logger } from '../common/logger/logger.service.js';

export class AiWorker {
  private worker: Worker | null = null;

  public constructor(
    private readonly aiService: AiService = new AiService(
      new PrismaAiRepository(),
      new AiProviderFactory(),
      new RedisPromptCache(),
      eventBus,
    ),
  ) {}

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.AI,
      async (job: Job<AiGenerationJobPayload>) => {
        return this.processJob(job);
      },
      {
        connection: redis,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[AiWorker] Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[AiWorker] Job ${job?.id} failed:`, err);
    });

    logger.info('[AiWorker] Worker started listening to ai-queue');
    return this.worker;
  }

  public async processJob(job: Job<AiGenerationJobPayload>): Promise<any> {
    const { payload } = { payload: job.data };
    logger.info(`[AiWorker] Processing AI job ${job.id} for coaching ${payload.coachingId}, feature: ${payload.feature}`);

    if (payload.feature === 'ai.student_narrative' && payload.studentId) {
      return this.aiService.generateStudentMonthlyProgress(
        { studentId: payload.studentId },
        payload.coachingId,
        payload.userId,
        payload.correlationId,
      );
    }

    if (payload.feature === 'ai.parent_report' && payload.studentId) {
      return this.aiService.generateParentWhatsAppReportCard(
        { studentId: payload.studentId },
        payload.coachingId,
        payload.userId,
        payload.correlationId,
      );
    }

    if (payload.feature === 'ai.teacher_insight' && payload.teacherId) {
      return this.aiService.generateTeacherPerformanceInsight(
        { teacherId: payload.teacherId },
        payload.coachingId,
        payload.userId,
        payload.correlationId,
      );
    }

    if (payload.prompt) {
      return this.aiService.generateCompletion(
        { prompt: payload.prompt, feature: payload.feature },
        payload.coachingId,
        payload.userId,
        payload.correlationId,
      );
    }

    logger.warn(`[AiWorker] Unrecognized job payload for job ${job.id}`);
    return null;
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
