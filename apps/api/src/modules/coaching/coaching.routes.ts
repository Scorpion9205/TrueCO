import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { CoachingController } from './coaching.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { rateLimit } from '../../common/middleware/rate-limit.middleware.js';

export function createCoachingRoutes(controller: CoachingController): Router {
  const router = createRouter();

  // Public: Self-serve coaching onboarding
  router.post('/register', rateLimit({ name: 'coaching-register', windowSeconds: 3600, max: 5 }), controller.register);

  // Protected: Current coaching institute profile
  router.get('/me', authenticateMiddleware, controller.getProfile);

  return router;
}
