import { logger } from '../../common/logger/logger.service.js';

export class NoticeJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[NoticeJobs] Notice background workers registered');
  }
}
