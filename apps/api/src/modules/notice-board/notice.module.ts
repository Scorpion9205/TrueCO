import { Router } from 'express';
import { PrismaNoticeRepository } from './notice.repository.js';
import { NoticeService } from './notice.service.js';
import { NoticeController } from './notice.controller.js';
import { createNoticeRoutes } from './notice.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { NoticeSubscribers } from './notice.subscribers.js';

export class NoticeModule {
  public static init(): {
    router: Router;
    service: NoticeService;
  } {
    const repository = new PrismaNoticeRepository();
    const service = new NoticeService(repository, eventBus);
    const controller = new NoticeController(service);
    const router = createNoticeRoutes(controller);

    NoticeSubscribers.register(eventBus);

    return { router, service };
  }
}
