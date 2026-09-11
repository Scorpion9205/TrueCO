import { Router } from 'express';
import { WhatsAppAssistantController } from './whatsapp-assistant.controller.js';

export function createWhatsAppAssistantRoutes(controller: WhatsAppAssistantController): Router {
  const router = Router();

  // Public webhook receiving incoming parent messages
  router.post('/inbound', controller.handleInbound);

  return router;
}
