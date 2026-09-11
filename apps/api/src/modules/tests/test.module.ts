import { Router } from 'express';
import { PrismaTestRepository } from './test.repository.js';
import { TestService } from './test.service.js';
import { TestController } from './test.controller.js';
import { createTestRoutes } from './test.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { TestSubscribers } from './test.subscribers.js';

export class TestModule {
  public static init(): { router: Router; service: TestService } {
    const repository = new PrismaTestRepository();
    const service = new TestService(repository, eventBus);
    const controller = new TestController(service);
    const router = createTestRoutes(controller);

    TestSubscribers.register(eventBus);

    return { router, service };
  }
}
