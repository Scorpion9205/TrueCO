import { logger } from '../../common/logger/logger.service.js';

export class FeeJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[FeeJobs] Reminder queue registered for fee notifications');
  }
}
