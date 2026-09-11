import { Router } from 'express';
import { RiskEngineController } from './risk-engine.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createRiskEngineRoutes(controller: RiskEngineController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.get('/students/:studentId', requirePermission('risk:read'), controller.getStudentRisk);
  router.get('/list', requirePermission('risk:read'), controller.listHighRisk);
  router.post('/compute/:studentId', requirePermission('risk:compute'), controller.recompute);
  router.post('/compute-all', requirePermission('risk:compute'), controller.recomputeAll);

  return router;
}
