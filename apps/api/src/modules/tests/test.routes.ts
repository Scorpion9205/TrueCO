import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { TestController } from './test.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createTestRoutes(controller: TestController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.post('/', requirePermission('tests:create'), requireBatchAccess(), controller.create);
  router.post(
    '/:id/marks',
    requirePermission('tests:create'),
    requireBatchAccess({ resource: 'test' }),
    controller.uploadMarks,
  );
  router.get(
    '/:id',
    requirePermission('tests:read'),
    requireBatchAccess({ resource: 'test' }),
    controller.getById,
  );
  router.get(
    '/batch/:batchId',
    requirePermission('tests:read'),
    requireBatchAccess(),
    controller.getByBatch,
  );
  router.get(
    '/student/:studentId',
    requirePermission('tests:read'),
    requireBatchAccess({ resource: 'student', key: 'studentId' }),
    controller.getByStudent,
  );

  return router;
}
