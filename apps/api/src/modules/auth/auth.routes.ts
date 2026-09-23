import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { AuthController } from './auth.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';

export function createAuthRoutes(controller: AuthController): Router {
  const router = createRouter();

  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', authenticateMiddleware, controller.logoutAllDevices);
  router.get('/me', authenticateMiddleware, controller.getMe);
  router.post('/forgot-password', controller.forgotPassword);
  router.post('/reset-password', controller.resetPassword);
  router.post('/verify-email', controller.verifyEmail);
  router.post('/send-otp', controller.sendOtp);
  router.post('/verify-otp', controller.verifyOtp);

  return router;
}
