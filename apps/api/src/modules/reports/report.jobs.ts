import { logger } from '../../common/logger/logger.service.js';

export class ReportJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[ReportJobs] Asynchronous report generation workers registered');
  }
}
