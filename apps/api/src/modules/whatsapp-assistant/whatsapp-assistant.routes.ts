import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { WhatsAppAssistantController } from './whatsapp-assistant.controller.js';

export function createWhatsAppAssistantRoutes(_controller: WhatsAppAssistantController): Router {
  const router = createRouter();

  // Intentionally no public routes. Inbound parent messages arrive only through the
  // HMAC-verified Meta webhook (POST /api/v1/notifications/webhook), which enqueues them
  // for InboundWhatsAppWorker. An endpoint that accepts the sender phone from the request
  // body lets any caller impersonate a parent and read that family's data.

  return router;
}
