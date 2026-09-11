import { logger } from '../../common/logger/logger.service.js';

export class ImportCron {
  public static async cleanupStagingFiles(): Promise<void> {
    logger.debug('[ImportCron] Staging import files cleanup executed');
  }
}
