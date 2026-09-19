import { Router } from 'express';
import { PrismaRiskEngineRepository } from './risk-engine.repository.js';
import { RiskEngineService } from './risk-engine.service.js';
import { RiskEngineController } from './risk-engine.controller.js';
import { createRiskEngineRoutes } from './risk-engine.routes.js';
import { eventBus } from '../../events/event-bus.js';
import { RiskEngineSubscribers } from './risk-engine.subscribers.js';

export class RiskEngineModule {
  public static init(): {
    router: Router;
    service: RiskEngineService;
  } {
    const repository = new PrismaRiskEngineRepository();
    const service = new RiskEngineService(repository, eventBus);
    const controller = new RiskEngineController(service);
    const router = createRiskEngineRoutes(controller);

    RiskEngineSubscribers.register(eventBus, service);

    return { router, service };
  }
}
