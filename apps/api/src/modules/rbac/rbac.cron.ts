import { logger } from '../../common/logger/logger.service.js';

export class RbacCron {
  public static registerJobs(): void {
    logger.debug('[RbacCron] No cron jobs required for RBAC module');
  }
}
