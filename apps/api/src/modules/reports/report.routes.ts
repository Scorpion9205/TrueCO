import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { ReportController } from './report.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createReportRoutes(controller: ReportController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware);

  router.get('/fees', requirePermission('reports:read'), controller.getFeeReport);
  router.get('/attendance', requirePermission('reports:read'), controller.getAttendanceReport);
  router.get('/pnl', requirePermission('reports:read'), controller.getProfitLossReport);

  return router;
}
