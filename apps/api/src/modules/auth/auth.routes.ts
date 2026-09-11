import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', authenticateMiddleware, controller.logoutAllDevices);

  return router;
}
