import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { AttendanceController } from './attendance.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createAttendanceRoutes(controller: AttendanceController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.post('/', requirePermission('attendance:mark'), requireBatchAccess(), controller.mark);
  router.get(
    '/sessions/:id',
    requirePermission('attendance:read'),
    requireBatchAccess({ resource: 'attendanceSession' }),
    controller.getSession,
  );
  router.get(
    '/batches/:batchId',
    requirePermission('attendance:read'),
    requireBatchAccess(),
    controller.getBatchHistory,
  );

  return router;
}
