import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { FeeController } from './fee.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createFeeRoutes(controller: FeeController): Router {
  const router = createRouter();

  // Webhook endpoint (unauthenticated, HMAC verified)
  router.post('/webhook', controller.handleWebhook);

  router.use(authenticateMiddleware);

  router.post('/plans', requirePermission('fees:create'), controller.createPlan);
  router.post('/pay', requirePermission('fees:pay'), controller.pay);
  router.post('/installments/:id/waive', requirePermission('fees:waive'), controller.waive);
  router.post('/installments/:id/payment-link', requirePermission('fees:pay'), controller.createPaymentLink);
  router.get('/defaulters', requirePermission('fees:read'), controller.getDefaulters);
  router.get('/students/:studentId', requirePermission('fees:read'), controller.getByStudent);
  router.get('/plans/:id', requirePermission('fees:read'), controller.getPlan);

  return router;
}
