/**
 * The whatsapp-assistant module has no scheduled jobs. The file is kept to follow the module layout
 * (.agents/rules/module-structure.md); register BullMQ repeatable jobs here when one is needed.
 */
export class WhatsAppAssistantCron {
  public static async expireInactiveSessions(): Promise<void> {
    // Intentionally empty: this module has no scheduled jobs yet
  }
}
