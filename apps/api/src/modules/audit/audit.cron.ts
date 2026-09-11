import { logger } from '../../common/logger/logger.service.js';

export class AuditCron {
  public static registerJobs(): void {
    logger.debug('[AuditCron] Audit log archival cron registered');
  }
}
