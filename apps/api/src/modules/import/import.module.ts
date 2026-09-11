import { Router } from 'express';
import { PrismaImportRepository } from './import.repository.js';
import { ImportService } from './import.service.js';
import { ImportController } from './import.controller.js';
import { createImportRoutes } from './import.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { ImportSubscribers } from './import.subscribers.js';

export class ImportModule {
  public static init(): {
    router: Router;
    service: ImportService;
  } {
    const repository = new PrismaImportRepository();
    const service = new ImportService(repository, eventBus);
    const controller = new ImportController(service);
    const router = createImportRoutes(controller);

    ImportSubscribers.register(eventBus);

    return { router, service };
  }
}
