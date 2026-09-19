import { Router } from 'express';
import { PrismaNotificationRepository } from './notification.repository.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { createNotificationRoutes } from './notification.routes.js';
import { queueRegistry } from '../../queues/queue.registry.js';
import { eventBus } from '../../events/event-bus.js';
import { NotificationSubscribers } from './notification.subscribers.js';
import { WhatsAppAssistantService } from '../whatsapp-assistant/whatsapp-assistant.service.js';

export interface NotificationModuleOptions {
  assistantService?: WhatsAppAssistantService;
}

export class NotificationModule {
  public static init(options?: NotificationModuleOptions): { router: Router; service: NotificationService } {
    const repository = new PrismaNotificationRepository();
    const service = new NotificationService(repository, queueRegistry, eventBus);
    const controller = new NotificationController(service, options?.assistantService);
    const router = createNotificationRoutes(controller);

    NotificationSubscribers.register(eventBus, service);

    return { router, service };
  }
}
