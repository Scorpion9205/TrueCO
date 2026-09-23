import { Worker, Job } from 'bullmq';
import { QueueRegistry, QUEUE_NAMES } from '../queues/queue.registry.js';
import { WhatsAppAssistantService } from '../modules/whatsapp-assistant/whatsapp-assistant.service.js';
import { PrismaWhatsAppAssistantRepository } from '../modules/whatsapp-assistant/whatsapp-assistant.repository.js';
import { eventBus } from '../events/event-bus.js';
import { logger } from '../common/logger/logger.service.js';

export interface InboundWhatsAppJobPayload {
  readonly messageId: string;
  readonly from: string;
  readonly body: string;
  readonly timestamp: number;
}

export class InboundWhatsAppWorker {
  private worker: Worker | null = null;
  private assistantService: WhatsAppAssistantService;

  public constructor(assistantService?: WhatsAppAssistantService) {
    if (assistantService) {
      this.assistantService = assistantService;
    } else {
      const repository = new PrismaWhatsAppAssistantRepository();
      this.assistantService = new WhatsAppAssistantService(repository, eventBus);
    }
  }

  public setAssistantService(service: WhatsAppAssistantService): void {
    this.assistantService = service;
  }

  public start(): Worker {
    const queueRegistry = QueueRegistry.getInstance();
    const redis = queueRegistry.getRedisClient();

    this.worker = new Worker(
      QUEUE_NAMES.INBOUND_WHATSAPP,
      async (job: Job<InboundWhatsAppJobPayload>) => {
        // No tenant yet: WhatsAppAssistantService resolves the sender's coaching as a system
        // lookup, then handles the message inside that coaching's tenant context.
        return this.processJob(job);
      },
      {
        connection: redis,
        concurrency: 10,
        limiter: {
          max: 100,
          duration: 1000,
        },
      },
    );

    this.worker.on('completed', (job: Job) => {
      logger.debug(`[InboundWhatsAppWorker] Inbound message job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`[InboundWhatsAppWorker] Inbound message job ${job?.id} failed:`, err);
    });

    logger.info('[InboundWhatsAppWorker] Inbound WhatsApp queue worker started');
    return this.worker;
  }

  public async processJob(job: Job<InboundWhatsAppJobPayload>): Promise<{ success: boolean; messageId: string }> {
    const { messageId, from, body, timestamp } = job.data;

    logger.info(`[InboundWhatsAppWorker] Processing inbound message ${messageId} from ${from}`);

    try {
      const reply = await this.assistantService.processInboundMessage({
        messageId,
        from,
        body,
        timestamp,
      });

      logger.info(
        `[InboundWhatsAppWorker] Completed inbound processing for ${messageId} (intent: ${reply?.intent || 'NONE'})`,
      );

      return { success: true, messageId };
    } catch (err) {
      logger.error(`[InboundWhatsAppWorker] Failed to process message ${messageId}:`, err);
      throw err;
    }
  }

  public async close(): Promise<void> {
    if (this.worker) {
      logger.info('[InboundWhatsAppWorker] Shutting down Inbound WhatsApp worker...');
      await this.worker.close();
      this.worker = null;
    }
  }
}
