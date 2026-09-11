import { logger } from '../../common/logger/logger.service.js';

export class SettingsJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[SettingsJobs] Settings background tasks registered');
  }
}
