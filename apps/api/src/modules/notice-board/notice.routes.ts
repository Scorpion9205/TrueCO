import { Router } from 'express';
import { NoticeController } from './notice.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/decorators/require-permission.decorator.js';

export function createNoticeRoutes(controller: NoticeController): Router {
  const router = Router();

  router.use(authenticateMiddleware);

  router.post('/', requirePermission('notices:manage'), controller.create);
  router.get('/', requirePermission('notices:read'), controller.list);
  router.get('/:id', requirePermission('notices:read'), controller.getById);
  router.put('/:id', requirePermission('notices:manage'), controller.update);
  router.delete('/:id', requirePermission('notices:manage'), controller.delete);

  return router;
}
