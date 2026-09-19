import { Router } from 'express';
import { BatchController } from './batch.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createBatchRoutes(controller: BatchController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('batches:create'), controller.create);
  router.get('/', requirePermission('batches:read'), controller.list);
  router.get('/:id', requirePermission('batches:read'), controller.getById);
  router.get('/:id/students', requirePermission('batches:read'), controller.getStudents);
  router.post('/:id/students', requirePermission('batches:update'), controller.enrollStudent);
  router.delete('/:id/students/:studentId', requirePermission('batches:update'), controller.withdrawStudent);
  router.post('/:id/transfer-student', requirePermission('batches:update'), controller.transferStudent);
  router.post('/:id/teachers', requirePermission('batches:update'), controller.assignTeacher);

  return router;
}
