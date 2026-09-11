import { Router } from 'express';
import { PrismaWhatsAppAssistantRepository } from './whatsapp-assistant.repository.js';
import { WhatsAppAssistantService } from './whatsapp-assistant.service.js';
import { WhatsAppAssistantController } from './whatsapp-assistant.controller.js';
import { createWhatsAppAssistantRoutes } from './whatsapp-assistant.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { WhatsAppAssistantSubscribers } from './whatsapp-assistant.subscribers.js';

export class WhatsAppAssistantModule {
  public static init(): {
    router: Router;
    service: WhatsAppAssistantService;
  } {
    const repository = new PrismaWhatsAppAssistantRepository();
    const service = new WhatsAppAssistantService(repository, eventBus);
    const controller = new WhatsAppAssistantController(service);
    const router = createWhatsAppAssistantRoutes(controller);

    WhatsAppAssistantSubscribers.register(eventBus);

    return { router, service };
  }
}
