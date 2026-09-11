import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createNotificationRoutes(controller: NotificationController): Router {
  const router = Router();

  // Public Meta Webhook Endpoints (unauthenticated, handshake & payload verification)
  router.get('/webhook', controller.verifyWebhook);
  router.post('/webhook', controller.handleWebhook);

  // Protected Tenant Endpoints
  router.get(
    '/failed',
    authenticateMiddleware,
    requirePermission('notifications:read'),
    controller.getFailed,
  );

  router.post(
    '/:id/retry',
    authenticateMiddleware,
    requirePermission('notifications:retry'),
    controller.retry,
  );

  return router;
}
