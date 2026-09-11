import { Router } from 'express';
import { HomeworkController } from './homework.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createHomeworkRoutes(controller: HomeworkController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('homework:create'), requireBatchAccess(), controller.create);
  router.put('/:id', requirePermission('homework:update'), controller.update);
  router.get('/:id', requirePermission('homework:read'), controller.getById);
  router.get('/batch/:batchId', requirePermission('homework:read'), requireBatchAccess(), controller.getByBatch);
  router.delete('/:id', requirePermission('homework:delete'), controller.delete);

  return router;
}
