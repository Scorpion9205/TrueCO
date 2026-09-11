import { logger } from '../../common/logger/logger.service.js';

export class RbacJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[RbacJobs] No asynchronous background jobs for RBAC module');
  }
}
