import { Router } from 'express';
import { PrismaSettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';
import { SettingsController } from './settings.controller.js';
import { createSettingsRoutes } from './settings.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { SettingsSubscribers } from './settings.subscribers.js';

export class SettingsModule {
  public static init(): {
    router: Router;
    service: SettingsService;
  } {
    const repository = new PrismaSettingsRepository();
    const service = new SettingsService(repository, eventBus);
    const controller = new SettingsController(service);
    const router = createSettingsRoutes(controller);

    SettingsSubscribers.register(eventBus);

    return { router, service };
  }
}
