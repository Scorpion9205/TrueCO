import { Router } from 'express';
import { PrismaCoachingRepository } from './coaching.repository.js';
import { CoachingService } from './coaching.service.js';
import { CoachingController } from './coaching.controller.js';
import { createCoachingRoutes } from './coaching.routes.js';
import { passwordService } from '../../common/security/password.service.js';
import { eventBus } from '../../events/event-bus.js';
import { CoachingSubscribers } from './coaching.subscribers.js';

export class CoachingModule {
  public static init(): { router: Router; service: CoachingService } {
    const repository = new PrismaCoachingRepository();
    const service = new CoachingService(repository, passwordService, eventBus);
    const controller = new CoachingController(service);
    const router = createCoachingRoutes(controller);

    CoachingSubscribers.register(eventBus);

    return { router, service };
  }
}
