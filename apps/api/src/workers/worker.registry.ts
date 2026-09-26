import { WhatsAppWorker } from './whatsapp.worker.js';
import { InboundWhatsAppWorker } from './inbound-whatsapp.worker.js';
import { EmailWorker } from './email.worker.js';
import { AiWorker } from './ai.worker.js';
import { ReminderWorker } from './reminder.worker.js';
import { PdfWorker } from './pdf.worker.js';
import { ReportWorker } from './report.worker.js';
import { AnalyticsWorker } from './analytics.worker.js';
import { CleanupWorker } from './cleanup.worker.js';
import { EventRelayWorker } from './event-relay.worker.js';
import { logger } from '../common/logger/logger.service.js';
import { WhatsAppAssistantService } from '../modules/whatsapp-assistant/whatsapp-assistant.service.js';

export class WorkerRegistry {
  private static instance: WorkerRegistry;
  private readonly whatsAppWorker: WhatsAppWorker;
  private readonly inboundWhatsAppWorker: InboundWhatsAppWorker;
  private readonly emailWorker: EmailWorker;
  private readonly aiWorker: AiWorker;
  private readonly reminderWorker: ReminderWorker;
  private readonly pdfWorker: PdfWorker;
  private readonly reportWorker: ReportWorker;
  private readonly analyticsWorker: AnalyticsWorker;
  private readonly cleanupWorker: CleanupWorker;
  private readonly eventRelayWorker: EventRelayWorker;
  private isRunning: boolean = false;

  private constructor() {
    this.whatsAppWorker = new WhatsAppWorker();
    this.inboundWhatsAppWorker = new InboundWhatsAppWorker();
    this.emailWorker = new EmailWorker();
    this.aiWorker = new AiWorker();
    this.reminderWorker = new ReminderWorker();
    this.pdfWorker = new PdfWorker();
    this.reportWorker = new ReportWorker();
    this.analyticsWorker = new AnalyticsWorker();
    this.cleanupWorker = new CleanupWorker();
    this.eventRelayWorker = new EventRelayWorker();
  }

  public static getInstance(): WorkerRegistry {
    if (!WorkerRegistry.instance) {
      WorkerRegistry.instance = new WorkerRegistry();
    }
    return WorkerRegistry.instance;
  }

  public setWhatsAppAssistantService(service: WhatsAppAssistantService): void {
    this.inboundWhatsAppWorker.setAssistantService(service);
  }

  public async startAll(): Promise<void> {
    if (this.isRunning) return;

    logger.info('[WorkerRegistry] Initializing BullMQ background workers...');
    this.whatsAppWorker.start();
    this.inboundWhatsAppWorker.start();
    this.emailWorker.start();
    this.aiWorker.start();
    await this.reminderWorker.start();
    this.pdfWorker.start();
    this.reportWorker.start();
    this.analyticsWorker.start();
    await this.cleanupWorker.start();
    await this.eventRelayWorker.start();
    this.isRunning = true;
    logger.info('[WorkerRegistry] All BullMQ background workers started successfully');
  }

  public async closeAll(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('[WorkerRegistry] Gracefully stopping BullMQ workers...');
    await Promise.all([
      this.whatsAppWorker.close(),
      this.inboundWhatsAppWorker.close(),
      this.emailWorker.close(),
      this.aiWorker.close(),
      this.reminderWorker.close(),
      this.pdfWorker.close(),
      this.reportWorker.close(),
      this.analyticsWorker.close(),
      this.cleanupWorker.close(),
      this.eventRelayWorker.close(),
    ]);
    this.isRunning = false;
    logger.info('[WorkerRegistry] All workers stopped');
  }
}

export const workerRegistry = WorkerRegistry.getInstance();
