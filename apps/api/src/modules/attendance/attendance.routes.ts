import { Router } from 'express';
import { AttendanceController } from './attendance.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createAttendanceRoutes(controller: AttendanceController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('attendance:mark'), requireBatchAccess(), controller.mark);
  router.get('/sessions/:id', requirePermission('attendance:read'), controller.getSession);
  router.get('/batches/:batchId', requirePermission('attendance:read'), requireBatchAccess(), controller.getBatchHistory);

  return router;
}
