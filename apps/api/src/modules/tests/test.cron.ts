import { logger } from '../../common/logger/logger.service.js';

export class TestCron {
  public static registerJobs(): void {
    logger.debug('[TestCron] Upcoming test reminder cron registered');
  }
}
