import { logger } from '../../common/logger/logger.service.js';

export class SettingsCron {
  public static async refreshTenantCaches(): Promise<void> {
    logger.debug('[SettingsCron] Tenant settings cache refresh executed');
  }
}
