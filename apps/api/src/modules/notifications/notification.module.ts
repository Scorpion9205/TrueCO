import { Router } from 'express';
import { PrismaNotificationRepository } from './notification.repository.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { createNotificationRoutes } from './notification.routes.js';
import { queueRegistry } from '../../queues/queue.registry.js';
import { eventBus } from '../../events/event-bus.js';
import { NotificationSubscribers } from './notification.subscribers.js';

export class NotificationModule {
  public static init(): { router: Router; service: NotificationService } {
    const repository = new PrismaNotificationRepository();
    const service = new NotificationService(repository, queueRegistry, eventBus);
    const controller = new NotificationController(service);
    const router = createNotificationRoutes(controller);

    NotificationSubscribers.register(eventBus, service);

    return { router, service };
  }
}
