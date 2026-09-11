import { logger } from '../../common/logger/logger.service.js';

export class StudentJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[StudentJobs] No background jobs defined for Students module');
  }
}
