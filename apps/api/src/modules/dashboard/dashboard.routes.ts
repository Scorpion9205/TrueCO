import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { DashboardController } from './dashboard.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createDashboardRoutes(controller: DashboardController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.get('/owner', requirePermission('dashboard:owner'), controller.getOwnerDashboard);
  router.get('/teacher', requirePermission('dashboard:teacher'), controller.getTeacherDashboard);

  return router;
}
