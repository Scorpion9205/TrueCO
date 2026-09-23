import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { TimelineController } from './timeline.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';
import { requireBatchAccess } from '../../common/decorators/require-batch-access.decorator.js';

export function createTimelineRoutes(controller: TimelineController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.get(
    '/student/:studentId',
    requirePermission('students:read'),
    requireBatchAccess({ resource: 'student', key: 'studentId' }),
    controller.getTimeline,
  );

  return router;
}
