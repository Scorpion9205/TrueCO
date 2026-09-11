import { Router } from 'express';
import { PrismaSalaryRepository } from './salary.repository.js';
import { SalaryService } from './salary.service.js';
import { SalaryController } from './salary.controller.js';
import { createSalaryRoutes } from './salary.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { SalarySubscribers } from './salary.subscribers.js';

export class SalaryModule {
  public static init(): { router: Router; service: SalaryService } {
    const repository = new PrismaSalaryRepository();
    const service = new SalaryService(repository, eventBus);
    const controller = new SalaryController(service);
    const router = createSalaryRoutes(controller);

    SalarySubscribers.register(eventBus);

    return { router, service };
  }
}
