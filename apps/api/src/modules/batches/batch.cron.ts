import { logger } from '../../common/logger/logger.service.js';

export class BatchCron {
  public static registerJobs(): void {
    logger.debug('[BatchCron] No cron jobs required for Batches module');
  }
}
