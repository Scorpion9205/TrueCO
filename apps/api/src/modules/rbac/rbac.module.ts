import { Router } from 'express';
import { PrismaRbacRepository } from './rbac.repository.js';
import { RbacService } from './rbac.service.js';
import { RbacController } from './rbac.controller.js';
import { createRbacRoutes } from './rbac.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { RbacSubscribers } from './rbac.subscribers.js';

export class RbacModule {
  public static init(): { router: Router; service: RbacService } {
    const repository = new PrismaRbacRepository();
    const service = new RbacService(repository, eventBus);
    const controller = new RbacController(service);
    const router = createRbacRoutes(controller);

    RbacSubscribers.register(eventBus);

    return { router, service };
  }
}
