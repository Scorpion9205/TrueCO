import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { SalaryController } from './salary.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createSalaryRoutes(controller: SalaryController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware);

  router.post('/generate', requirePermission('salary:manage'), controller.generate);
  router.post('/pay', requirePermission('salary:pay'), controller.pay);
  router.get('/', requirePermission('salary:read'), controller.list);
  router.get('/teacher/:teacherId', requirePermission('salary:read'), controller.getByTeacher);

  return router;
}
