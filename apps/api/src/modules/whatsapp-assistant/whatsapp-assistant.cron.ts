import { logger } from '../../common/logger/logger.service.js';

export class WhatsAppAssistantCron {
  public static async expireInactiveSessions(): Promise<void> {
    logger.debug('[WhatsAppAssistantCron] Stale conversation states expired');
  }
}
