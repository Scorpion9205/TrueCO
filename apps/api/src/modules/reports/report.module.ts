import { Router } from 'express';
import { PrismaReportRepository } from './report.repository.js';
import { ReportService } from './report.service.js';
import { ReportController } from './report.controller.js';
import { createReportRoutes } from './report.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { ReportSubscribers } from './report.subscribers.js';

export class ReportModule {
  public static init(): {
    router: Router;
    service: ReportService;
  } {
    const repository = new PrismaReportRepository();
    const service = new ReportService(repository, eventBus);
    const controller = new ReportController(service);
    const router = createReportRoutes(controller);

    ReportSubscribers.register(eventBus);

    return { router, service };
  }
}
