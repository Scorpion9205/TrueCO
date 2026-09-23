import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { RiskEngineController } from './risk-engine.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireFeature } from '../../common/decorators/require-feature.decorator.js';

export function createRiskEngineRoutes(controller: RiskEngineController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware);
  router.use(requireFeature('ai.risk_engine'));

  router.get('/students/:studentId', requirePermission('risk:read'), controller.getStudentRisk);
  router.get('/list', requirePermission('risk:read'), controller.listHighRisk);
  router.post('/compute/:studentId', requirePermission('risk:compute'), controller.recompute);
  router.post('/compute-all', requirePermission('risk:compute'), controller.recomputeAll);

  return router;
}
