import { logger } from '../../common/logger/logger.service.js';

export class TeacherCron {
  public static registerJobs(): void {
    logger.debug('[TeacherCron] No cron jobs for Teachers module');
  }
}
