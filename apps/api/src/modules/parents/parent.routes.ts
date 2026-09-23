import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { ParentController } from './parent.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createParentRoutes(controller: ParentController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('students:create'), controller.create);
  router.post('/link', requirePermission('students:update'), controller.linkStudent);
  router.get('/', requirePermission('students:read'), controller.list);
  router.get('/:id', requirePermission('students:read'), controller.getById);

  return router;
}
