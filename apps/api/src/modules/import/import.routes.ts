import { Router } from 'express';
import { ImportController } from './import.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createImportRoutes(controller: ImportController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('data:import'), controller.importBulkData);

  return router;
}
