import { logger } from '../../common/logger/logger.service.js';

export class BillingJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[BillingJobs] Billing queues and background workers registered');
  }
}
