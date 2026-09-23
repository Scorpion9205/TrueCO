import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { AiController } from './ai.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requireFeature } from '../../common/decorators/require-feature.decorator.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createAiRouter(controller: AiController): Router {
  const router = createRouter();

  // All AI routes require authentication and feature entitlement
  router.use(authenticateMiddleware);
  router.use(requireFeature('ai.insights'));

  // Credit & Wallet Management
  router.get('/wallet', controller.getWalletBalance);
  router.post('/wallet/add-credits', requirePermission('ai:manage_credits'), controller.addCredits);
  router.get('/usage-logs', requirePermission('ai:view_logs'), controller.getUsageLogs);

  // AI Generation Endpoints
  router.post('/completion', requirePermission('ai:generate'), controller.generateCompletion);
  router.post('/student-narrative', requirePermission('ai:generate'), controller.generateStudentNarrative);
  router.post('/parent-report-card', requirePermission('ai:generate'), controller.generateParentReportCard);
  router.post('/teacher-insight', requirePermission('ai:generate'), controller.generateTeacherInsight);

  return router;
}
