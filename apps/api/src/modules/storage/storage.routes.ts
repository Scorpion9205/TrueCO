import { Router } from 'express';
import { StorageController } from './storage.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';

export function createStorageRoutes(controller: StorageController): Router {
  const router = Router();

  // Public/direct download for mock storage in development
  router.get('/files/*', controller.serveFile);

  // Authenticated storage operations
  router.post('/presigned-url', authenticateMiddleware, controller.getPresignedUrl);
  router.post('/upload', authenticateMiddleware, controller.directUpload);

  return router;
}
