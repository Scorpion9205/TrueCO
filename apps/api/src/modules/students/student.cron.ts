import { logger } from '../../common/logger/logger.service.js';

export class StudentCron {
  public static registerJobs(): void {
    logger.debug('[StudentCron] No scheduled cron tasks for Students module');
  }
}
