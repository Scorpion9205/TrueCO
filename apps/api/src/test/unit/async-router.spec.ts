import { describe, it, expect } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { createRouter } from '../../common/http/async-router.js';
import { AppError, errorHandlerMiddleware } from '../../common/middleware/error-handler.middleware.js';

function buildApp() {
  const router = createRouter();

  router.post('/async-throw', async (_req: Request, _res: Response) => {
    await Promise.resolve();
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', StatusCodes.UNAUTHORIZED);
  });

  router.get(
    '/async-middleware',
    async (_req: Request, _res: Response, _next: NextFunction) => {
      throw new AppError('FORBIDDEN', 'Denied', StatusCodes.FORBIDDEN);
    },
    (_req: Request, res: Response) => {
      res.json({ reached: true });
    },
  );

  router.get('/sync-throw', () => {
    throw new Error('boom');
  });

  router.get('/ok', async (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  const app = express();
  app.use(router);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('createRouter async error forwarding', () => {
  const app = buildApp();

  it('forwards a rejected async handler to the error handler', async () => {
    const res = await request(app).post('/async-throw');
    expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('forwards a rejected async middleware and skips later handlers', async () => {
    const res = await request(app).get('/async-middleware');
    expect(res.status).toBe(StatusCodes.FORBIDDEN);
    expect(res.body.reached).toBeUndefined();
  });

  it('forwards synchronous throws as 500', async () => {
    const res = await request(app).get('/sync-throw');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('leaves successful handlers unaffected', async () => {
    const res = await request(app).get('/ok');
    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.ok).toBe(true);
  });
});
