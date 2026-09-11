import { Router } from 'express';
import { TestController } from './test.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createTestRoutes(controller: TestController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('tests:create'), requireBatchAccess(), controller.create);
  router.post('/:id/marks', requirePermission('tests:create'), controller.uploadMarks);
  router.get('/:id', requirePermission('tests:read'), controller.getById);
  router.get('/batch/:batchId', requirePermission('tests:read'), requireBatchAccess(), controller.getByBatch);

  return router;
}
