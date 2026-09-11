import { logger } from '../../common/logger/logger.service.js';

export class ParentJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[ParentJobs] No background jobs defined for Parents module');
  }
}
