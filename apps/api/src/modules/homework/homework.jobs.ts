import { logger } from '../../common/logger/logger.service.js';

export class HomeworkJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[HomeworkJobs] No background jobs defined for Homework module');
  }
}
