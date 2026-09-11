import { Router } from 'express';
import { TimelineController } from './timeline.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createTimelineRoutes(controller: TimelineController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.get('/student/:studentId', requirePermission('students:read'), controller.getTimeline);

  return router;
}
