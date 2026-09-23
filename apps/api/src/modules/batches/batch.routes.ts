import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { BatchController } from './batch.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createBatchRoutes(controller: BatchController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.post('/', requirePermission('batches:create'), controller.create);
  router.get('/', requirePermission('batches:read'), controller.list);
  router.get(
    '/:id',
    requirePermission('batches:read'),
    requireBatchAccess({ resource: 'batch', source: 'params', key: 'id' }),
    controller.getById,
  );
  router.get(
    '/:id/students',
    requirePermission('batches:read'),
    requireBatchAccess({ resource: 'batch', source: 'params', key: 'id' }),
    controller.getStudents,
  );
  router.post('/:id/students', requirePermission('batches:update'), controller.enrollStudent);
  router.delete(
    '/:id/students/:studentId',
    requirePermission('batches:update'),
    controller.withdrawStudent,
  );
  router.post(
    '/:id/transfer-student',
    requirePermission('batches:update'),
    controller.transferStudent,
  );
  router.post('/:id/teachers', requirePermission('batches:update'), controller.assignTeacher);

  return router;
}
