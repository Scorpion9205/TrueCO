import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { SettingsController } from './settings.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireActiveSubscription } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createSettingsRoutes(controller: SettingsController): Router {
  const router = createRouter();

  router.use(authenticateMiddleware, requireActiveSubscription());

  router.get('/', requirePermission('settings:read'), controller.get);
  router.put('/', requirePermission('settings:manage'), controller.update);

  return router;
}
