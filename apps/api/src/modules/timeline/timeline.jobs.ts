import { logger } from '../../common/logger/logger.service.js';

export class TimelineJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[TimelineJobs] No background jobs defined for Timeline module');
  }
}
