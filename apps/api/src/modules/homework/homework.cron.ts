import { logger } from '../../common/logger/logger.service.js';

export class HomeworkCron {
  public static registerJobs(): void {
    logger.debug('[HomeworkCron] Homework due date reminder cron registered');
  }
}
