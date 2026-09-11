import { logger } from '../../common/logger/logger.service.js';

export class ExpenseJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[ExpenseJobs] No background jobs defined for Expense module');
  }
}
