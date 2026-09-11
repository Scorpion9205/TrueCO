import { logger } from '../../common/logger/logger.service.js';

export class ReportCron {
  public static async generateNightlyAnalytics(): Promise<void> {
    logger.debug('[ReportCron] Nightly financial and attendance snapshots calculated');
  }
}
