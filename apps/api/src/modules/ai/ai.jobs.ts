import { Queue } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../../queues/queue.registry.js';
import { logger } from '../../common/logger/logger.service.js';

export interface AiGenerationJobPayload {
  readonly jobId: string;
  readonly coachingId: string;
  readonly feature: string;
  readonly studentId?: string;
  readonly teacherId?: string;
  readonly prompt?: string;
  readonly correlationId: string;
  readonly userId?: string;
}

export class AiJobProducer {
  private queue: Queue | null = null;

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = QueueRegistry.getInstance().getQueue(QUEUE_NAMES.AI);
    }
    return this.queue;
  }

  public async enqueueGeneration(payload: AiGenerationJobPayload): Promise<void> {
    const queue = this.getQueue();
    const jobName = `ai-gen-${payload.feature}-${payload.studentId || payload.teacherId || payload.jobId}`;

    await queue.add(jobName, payload, {
      jobId: payload.jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    logger.info(`[AiJobProducer] Enqueued background AI generation job: ${jobName}`);
  }
}
