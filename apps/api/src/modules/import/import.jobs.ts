import { logger } from '../../common/logger/logger.service.js';

export class ImportJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[ImportJobs] Import queue background jobs registered');
  }
}
