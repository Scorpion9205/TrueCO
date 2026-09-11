import { logger } from '../../common/logger/logger.service.js';

export class AuditJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[AuditJobs] No background jobs defined for Audit module');
  }
}
