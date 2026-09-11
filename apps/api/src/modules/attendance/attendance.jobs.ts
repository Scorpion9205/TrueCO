import { logger } from '../../common/logger/logger.service.js';

export class AttendanceJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[AttendanceJobs] No background jobs defined for Attendance module');
  }
}
