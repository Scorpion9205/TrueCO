import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { TeacherController } from './teacher.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createTeacherRoutes(controller: TeacherController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.post('/', requirePermission('teachers:create'), controller.create);
  router.get('/', requirePermission('teachers:read'), controller.list);
  router.get('/:id', requirePermission('teachers:read'), controller.getById);
  router.put('/:id', requirePermission('teachers:update'), controller.update);

  return router;
}
