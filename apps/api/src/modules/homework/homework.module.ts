import { Router } from 'express';
import { PrismaHomeworkRepository } from './homework.repository.js';
import { HomeworkService } from './homework.service.js';
import { HomeworkController } from './homework.controller.js';
import { createHomeworkRoutes } from './homework.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { HomeworkSubscribers } from './homework.subscribers.js';

export class HomeworkModule {
  public static init(): { router: Router; service: HomeworkService } {
    const repository = new PrismaHomeworkRepository();
    const service = new HomeworkService(repository, eventBus);
    const controller = new HomeworkController(service);
    const router = createHomeworkRoutes(controller);

    HomeworkSubscribers.register(eventBus);

    return { router, service };
  }
}
