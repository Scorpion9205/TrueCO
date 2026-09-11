import { Router } from 'express';
import { CoachingController } from './coaching.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';

export function createCoachingRoutes(controller: CoachingController): Router {
  const router = Router();

  // Public: Self-serve coaching onboarding
  router.post('/register', controller.register);

  // Protected: Current coaching institute profile
  router.get('/me', authenticateMiddleware, controller.getProfile);

  return router;
}
