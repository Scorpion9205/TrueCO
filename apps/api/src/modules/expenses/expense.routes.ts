import { Router } from 'express';
import { ExpenseController } from './expense.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createExpenseRoutes(controller: ExpenseController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('expenses:create'), controller.create);
  router.get('/summary', requirePermission('expenses:read'), controller.summary);
  router.get('/', requirePermission('expenses:read'), controller.list);
  router.get('/:id', requirePermission('expenses:read'), controller.getById);
  router.put('/:id', requirePermission('expenses:update'), controller.update);
  router.delete('/:id', requirePermission('expenses:delete'), controller.delete);

  return router;
}
