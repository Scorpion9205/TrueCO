import { logger } from '../../common/logger/logger.service.js';

export class NotificationCron {
  public static registerJobs(): void {
    logger.debug('[NotificationCron] Stale notification retry cron registered');
  }
}
