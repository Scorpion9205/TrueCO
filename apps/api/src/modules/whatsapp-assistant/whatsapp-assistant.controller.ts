import { WhatsAppAssistantService } from './whatsapp-assistant.service.js';

/**
 * No HTTP handlers: inbound messages are processed by InboundWhatsAppWorker from the
 * signed Meta webhook. See whatsapp-assistant.routes.ts for why there is no public entrypoint.
 */
export class WhatsAppAssistantController {
  public constructor(_assistantService: WhatsAppAssistantService) {}
}
