import { Router } from 'express';
import { RbacController } from './rbac.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createRbacRoutes(controller: RbacController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.get('/roles', controller.getRoles);
  router.get('/permissions', controller.getPermissions);
  router.post('/users/:userId/roles', requirePermission('rbac:manage'), controller.assignRole);

  return router;
}
