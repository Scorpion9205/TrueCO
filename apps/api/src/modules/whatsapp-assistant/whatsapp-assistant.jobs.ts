import { logger } from '../../common/logger/logger.service.js';

export class WhatsAppAssistantJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[WhatsAppAssistantJobs] Assistant queues registered');
  }
}
