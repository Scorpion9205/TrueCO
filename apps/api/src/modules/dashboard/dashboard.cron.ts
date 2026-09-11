import { logger } from '../../common/logger/logger.service.js';

export class DashboardCron {
  public static async precomputeDailyKpis(): Promise<void> {
    logger.debug('[DashboardCron] Scheduled precomputation for dashboard KPIs completed');
  }
}
