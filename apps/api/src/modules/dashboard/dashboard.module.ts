import { Router } from 'express';
import { PrismaDashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';
import { createDashboardRoutes } from './dashboard.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { DashboardSubscribers } from './dashboard.subscribers.js';

export class DashboardModule {
  public static init(): {
    router: Router;
    service: DashboardService;
  } {
    const repository = new PrismaDashboardRepository();
    const service = new DashboardService(repository, eventBus);
    const controller = new DashboardController(service);
    const router = createDashboardRoutes(controller);

    DashboardSubscribers.register(eventBus);

    return { router, service };
  }
}
