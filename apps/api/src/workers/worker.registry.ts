import { WhatsAppWorker } from './whatsapp.worker.js';
import { EmailWorker } from './email.worker.js';
import { logger } from '../common/logger/logger.service.js';

export class WorkerRegistry {
  private static instance: WorkerRegistry;
  private readonly whatsAppWorker: WhatsAppWorker;
  private readonly emailWorker: EmailWorker;
  private isRunning: boolean = false;

  private constructor() {
    this.whatsAppWorker = new WhatsAppWorker();
    this.emailWorker = new EmailWorker();
  }

  public static getInstance(): WorkerRegistry {
    if (!WorkerRegistry.instance) {
      WorkerRegistry.instance = new WorkerRegistry();
    }
    return WorkerRegistry.instance;
  }

  public startAll(): void {
    if (this.isRunning) return;

    logger.info('[WorkerRegistry] Initializing BullMQ background workers...');
    this.whatsAppWorker.start();
    this.emailWorker.start();
    this.isRunning = true;
    logger.info('[WorkerRegistry] All background workers started successfully');
  }

  public async closeAll(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('[WorkerRegistry] Gracefully stopping BullMQ workers...');
    await Promise.all([
      this.whatsAppWorker.close(),
      this.emailWorker.close(),
    ]);
    this.isRunning = false;
    logger.info('[WorkerRegistry] All workers stopped');
  }
}

export const workerRegistry = WorkerRegistry.getInstance();
