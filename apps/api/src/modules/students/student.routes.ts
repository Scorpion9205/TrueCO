import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { StudentController } from './student.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createStudentRoutes(controller: StudentController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.post('/', requirePermission('students:create'), controller.create);
  router.get('/', requirePermission('students:read'), controller.list);
  router.get(
    '/:id',
    requirePermission('students:read'),
    requireBatchAccess({ resource: 'student' }),
    controller.getById,
  );
  router.put('/:id', requirePermission('students:update'), controller.update);
  router.delete('/:id', requirePermission('students:delete'), controller.delete);

  return router;
}
