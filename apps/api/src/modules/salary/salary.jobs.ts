import { logger } from '../../common/logger/logger.service.js';

export class SalaryJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[SalaryJobs] No background jobs defined for Salary module');
  }
}
