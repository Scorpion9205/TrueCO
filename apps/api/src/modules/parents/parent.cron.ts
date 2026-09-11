import { logger } from '../../common/logger/logger.service.js';

export class ParentCron {
  public static registerJobs(): void {
    logger.debug('[ParentCron] No scheduled cron tasks for Parents module');
  }
}
