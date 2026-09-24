/**
 * The reports module has no scheduled jobs. The file is kept to follow the module layout
 * (.agents/rules/module-structure.md); register BullMQ repeatable jobs here when one is needed.
 */
export class ReportCron {
  public static async generateNightlyAnalytics(): Promise<void> {
    // Intentionally empty: this module has no scheduled jobs yet
  }
}
