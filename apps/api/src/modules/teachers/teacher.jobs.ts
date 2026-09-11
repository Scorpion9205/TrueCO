import { logger } from '../../common/logger/logger.service.js';

export class TeacherJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[TeacherJobs] No background jobs for Teachers module');
  }
}
