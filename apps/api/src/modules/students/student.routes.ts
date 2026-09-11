import { Router } from 'express';
import { StudentController } from './student.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createStudentRoutes(controller: StudentController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('students:create'), controller.create);
  router.get('/', requirePermission('students:read'), controller.list);
  router.get('/:id', requirePermission('students:read'), controller.getById);
  router.put('/:id', requirePermission('students:update'), controller.update);
  router.delete('/:id', requirePermission('students:delete'), controller.delete);

  return router;
}
