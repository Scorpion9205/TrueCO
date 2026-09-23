import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { NotificationController } from './notification.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createNotificationRoutes(controller: NotificationController): Router {
  const router = createRouter();

  // Public Meta Webhook Endpoints (unauthenticated, handshake & payload verification)
  router.get('/webhook', controller.verifyWebhook);
  router.post('/webhook', controller.handleWebhook);

  // Protected Tenant Endpoints
  router.get(
    '/failed',
    authenticateMiddleware,
    requireActiveSubscription(),
    requirePermission('notifications:read'),
    controller.getFailed,
  );

  router.post(
    '/:id/retry',
    authenticateMiddleware,
    requireActiveSubscription(),
    requirePermission('notifications:retry'),
    controller.retry,
  );

  return router;
}
