import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { logger } from '../common/logger/logger.service.js';

export interface PdfJobPayload {
  readonly coachingId: string;
  readonly type: 'FEE_RECEIPT' | 'STUDENT_REPORT' | 'SALARY_SLIP';
  readonly referenceId: string;
  readonly metadata?: Record<string, unknown>;
}

export class PdfWorker {
  private worker: Worker | null = null;

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.PDF,
      async (job: Job<PdfJobPayload>) => {
        logger.info(`[PdfWorker] Generating PDF for ${job.data.type} (ref: ${job.data.referenceId})`);
        // Simulates PDF rendering pipeline (e.g. Puppeteer/pdfkit)
        const documentUrl = `/api/v1/storage/files/${job.data.coachingId}/receipt/${job.data.referenceId}.pdf`;
        return {
          status: 'GENERATED',
          documentUrl,
        };
      },
      {
        connection: redis,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[PdfWorker] PDF Job ${job.id} completed`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[PdfWorker] PDF Job ${job?.id} failed:`, err);
    });

    logger.info('[PdfWorker] Worker started listening to pdf-queue');
    return this.worker;
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
