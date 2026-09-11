import { Router } from 'express';
import { PrismaBillingRepository } from './billing.repository.js';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';
import { createBillingRoutes } from './billing.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { BillingSubscribers } from './billing.subscribers.js';
import { SubscriptionExpirationScheduler } from './billing.cron.js';

export class BillingModule {
  public static init(): {
    router: Router;
    service: BillingService;
    scheduler: SubscriptionExpirationScheduler;
  } {
    const repository = new PrismaBillingRepository();
    const service = new BillingService(repository, eventBus);
    const controller = new BillingController(service);
    const router = createBillingRoutes(controller);
    const scheduler = new SubscriptionExpirationScheduler(repository, eventBus);

    BillingSubscribers.register(eventBus);

    return { router, service, scheduler };
  }
}
