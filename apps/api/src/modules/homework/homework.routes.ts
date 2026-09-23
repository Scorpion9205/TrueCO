import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { HomeworkController } from './homework.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createHomeworkRoutes(controller: HomeworkController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.post('/', requirePermission('homework:create'), requireBatchAccess(), controller.create);
  router.put(
    '/:id',
    requirePermission('homework:update'),
    requireBatchAccess({ resource: 'homework' }),
    controller.update,
  );
  router.get(
    '/:id',
    requirePermission('homework:read'),
    requireBatchAccess({ resource: 'homework' }),
    controller.getById,
  );
  router.get(
    '/batch/:batchId',
    requirePermission('homework:read'),
    requireBatchAccess(),
    controller.getByBatch,
  );
  router.delete(
    '/:id',
    requirePermission('homework:delete'),
    requireBatchAccess({ resource: 'homework' }),
    controller.delete,
  );

  return router;
}
