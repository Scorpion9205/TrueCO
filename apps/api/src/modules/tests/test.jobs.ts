import { logger } from '../../common/logger/logger.service.js';

export class TestJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[TestJobs] No background jobs defined for Tests module');
  }
}
