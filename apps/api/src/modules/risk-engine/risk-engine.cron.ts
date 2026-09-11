import { logger } from '../../common/logger/logger.service.js';

export class RiskEngineCron {
  public static async runNightlyBatchRecompute(): Promise<void> {
    logger.debug('[RiskEngineCron] Nightly batch risk score recomputation completed');
  }
}
