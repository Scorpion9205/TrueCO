import { logger } from '../../common/logger/logger.service.js';

export class TimelineCron {
  public static registerJobs(): void {
    logger.debug('[TimelineCron] Timeline retention cleanup cron registered');
  }
}
