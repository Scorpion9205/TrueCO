import { logger } from '../../common/logger/logger.service.js';

export class CoachingJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[CoachingJobs] No asynchronous background jobs for Coaching module');
  }
}
