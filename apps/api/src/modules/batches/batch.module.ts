import { Router } from 'express';
import { PrismaBatchRepository } from './batch.repository.js';
import { BatchService } from './batch.service.js';
import { BatchController } from './batch.controller.js';
import { createBatchRoutes } from './batch.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { BatchSubscribers } from './batch.subscribers.js';

export class BatchModule {
  public static init(): { router: Router; service: BatchService } {
    const repository = new PrismaBatchRepository();
    const service = new BatchService(repository, eventBus);
    const controller = new BatchController(service);
    const router = createBatchRoutes(controller);

    BatchSubscribers.register(eventBus);

    return { router, service };
  }
}
