import { logger } from '../../common/logger/logger.service.js';

export class ExpenseCron {
  public static registerJobs(): void {
    logger.debug('[ExpenseCron] Monthly expense summary aggregation cron registered');
  }
}
