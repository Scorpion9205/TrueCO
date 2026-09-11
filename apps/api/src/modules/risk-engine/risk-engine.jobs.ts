import { logger } from '../../common/logger/logger.service.js';

export class RiskEngineJobs {
  public static async registerJobs(): Promise<void> {
    logger.debug('[RiskEngineJobs] Risk Engine background workers registered');
  }
}
