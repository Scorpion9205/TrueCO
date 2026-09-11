import { logger } from '../../common/logger/logger.service.js';

export class BatchJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[BatchJobs] No background jobs defined for Batches module');
  }
}
