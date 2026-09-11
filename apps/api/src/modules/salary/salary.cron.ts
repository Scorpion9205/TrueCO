import { logger } from '../../common/logger/logger.service.js';

export class SalaryCron {
  public static registerJobs(): void {
    logger.debug('[SalaryCron] Monthly salary generation scheduler registered');
  }
}
