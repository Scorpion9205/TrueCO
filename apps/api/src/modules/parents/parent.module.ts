import { Router } from 'express';
import { PrismaParentRepository } from './parent.repository.js';
import { ParentService } from './parent.service.js';
import { ParentController } from './parent.controller.js';
import { createParentRoutes } from './parent.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { ParentSubscribers } from './parent.subscribers.js';

export class ParentModule {
  public static init(): { router: Router; service: ParentService } {
    const repository = new PrismaParentRepository();
    const service = new ParentService(repository, eventBus);
    const controller = new ParentController(service);
    const router = createParentRoutes(controller);

    ParentSubscribers.register(eventBus);

    return { router, service };
  }
}
