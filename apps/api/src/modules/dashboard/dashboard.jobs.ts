import { logger } from '../../common/logger/logger.service.js';

export class DashboardJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[DashboardJobs] Dashboard aggregation background jobs registered');
  }
}
