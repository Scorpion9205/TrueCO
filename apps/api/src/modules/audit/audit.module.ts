import { Router } from 'express';
import { PrismaAuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';
import { createAuditRoutes } from './audit.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { AuditSubscribers } from './audit.subscribers.js';

export class AuditModule {
  public static init(): { router: Router; service: AuditService } {
    const repository = new PrismaAuditRepository();
    const service = new AuditService(repository, eventBus);
    const controller = new AuditController(service);
    const router = createAuditRoutes(controller);

    AuditSubscribers.register(eventBus, service);

    return { router, service };
  }
}
