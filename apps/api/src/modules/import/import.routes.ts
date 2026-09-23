import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { ImportController } from './import.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createImportRoutes(controller: ImportController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.post('/', requirePermission('data:import'), controller.importBulkData);

  return router;
}
