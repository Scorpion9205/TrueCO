import { Router } from 'express';
import { PrismaWhatsAppAssistantRepository } from './whatsapp-assistant.repository.js';
import { WhatsAppAssistantService } from './whatsapp-assistant.service.js';
import { WhatsAppAssistantController } from './whatsapp-assistant.controller.js';
import { createWhatsAppAssistantRoutes } from './whatsapp-assistant.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { NotificationService } from '../notifications/notification.service.js';
import { WhatsAppAssistantSubscribers } from './whatsapp-assistant.subscribers.js';

export interface WhatsAppAssistantModuleOptions {
  notificationService?: NotificationService;
}

export class WhatsAppAssistantModule {
  public static init(options?: WhatsAppAssistantModuleOptions): {
    router: Router;
    service: WhatsAppAssistantService;
  } {
    const repository = new PrismaWhatsAppAssistantRepository();
    const service = new WhatsAppAssistantService(repository, eventBus);
    const controller = new WhatsAppAssistantController(service);
    const router = createWhatsAppAssistantRoutes(controller);

    WhatsAppAssistantSubscribers.register(eventBus, options?.notificationService);

    return { router, service };
  }
}
