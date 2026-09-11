import { Router } from 'express';
import { PrismaExpenseRepository } from './expense.repository.js';
import { ExpenseService } from './expense.service.js';
import { ExpenseController } from './expense.controller.js';
import { createExpenseRoutes } from './expense.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { ExpenseSubscribers } from './expense.subscribers.js';

export class ExpenseModule {
  public static init(): { router: Router; service: ExpenseService } {
    const repository = new PrismaExpenseRepository();
    const service = new ExpenseService(repository, eventBus);
    const controller = new ExpenseController(service);
    const router = createExpenseRoutes(controller);

    ExpenseSubscribers.register(eventBus);

    return { router, service };
  }
}
