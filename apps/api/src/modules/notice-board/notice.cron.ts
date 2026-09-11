import { logger } from '../../common/logger/logger.service.js';

export class NoticeCron {
  public static async cleanupExpiredNotices(): Promise<void> {
    logger.debug('[NoticeCron] Scheduled cleanup for expired notices checked');
  }
}
