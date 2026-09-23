import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { StorageController } from './storage.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';

export function createStorageRoutes(controller: StorageController): Router {
  const router = createRouter();

  // Public/direct download for mock storage in development
  router.get('/files/*', controller.serveFile);

  // Authenticated storage operations
  router.post('/presigned-url', authenticateMiddleware, controller.getPresignedUrl);
  router.post('/upload', authenticateMiddleware, controller.directUpload);

  return router;
}
