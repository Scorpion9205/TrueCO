import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { BillingController } from './billing.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createBillingRoutes(controller: BillingController): Router {
  const router = createRouter();

  // Public plan listing
  router.get('/plans', controller.listPlans);

  // Protected billing routes
  router.get(
    '/subscription',
    authenticateMiddleware,
    requirePermission('billing:read'),
    controller.getSubscription,
  );

  // Plans and AI credits are bought through an order: POST /orders creates it at the server
  // price, and the payment webhook applies it. There is deliberately no route that grants a
  // plan or credits directly.
  router.post(
    '/orders',
    authenticateMiddleware,
    requirePermission('billing:manage'),
    controller.createOrder,
  );

  // Razorpay webhook endpoint
  router.post('/webhook', controller.handleWebhook);

  return router;
}
