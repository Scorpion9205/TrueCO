import { Router } from 'express';
import { PrismaTimelineRepository } from './timeline.repository.js';
import { TimelineService } from './timeline.service.js';
import { TimelineController } from './timeline.controller.js';
import { createTimelineRoutes } from './timeline.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { TimelineSubscribers } from './timeline.subscribers.js';

export class TimelineModule {
  public static init(): { router: Router; service: TimelineService } {
    const repository = new PrismaTimelineRepository();
    const service = new TimelineService(repository, eventBus);
    const controller = new TimelineController(service);
    const router = createTimelineRoutes(controller);

    TimelineSubscribers.register(eventBus, service);

    return { router, service };
  }
}
