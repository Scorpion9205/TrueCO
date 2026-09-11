import { logger } from '../../common/logger/logger.service.js';

export class CoachingCron {
  public static registerJobs(): void {
    logger.debug('[CoachingCron] No cron jobs required for Coaching module');
  }
}
