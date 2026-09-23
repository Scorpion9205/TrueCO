import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { AuditController } from './audit.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createAuditRoutes(controller: AuditController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware);

  router.get('/', requirePermission('audit:read'), controller.list);

  return router;
}
