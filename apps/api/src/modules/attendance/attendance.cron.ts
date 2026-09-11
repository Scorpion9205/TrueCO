import { logger } from '../../common/logger/logger.service.js';

export class AttendanceCron {
  public static registerJobs(): void {
    logger.debug('[AttendanceCron] Daily attendance reminder cron registered via scheduler');
  }
}
