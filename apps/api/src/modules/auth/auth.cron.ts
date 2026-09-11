import { logger } from '../../common/logger/logger.service.js';

export class AuthCron {
  public static registerJobs(): void {
    logger.debug('[AuthCron] No periodic cron jobs required for Auth module');
  }
}
