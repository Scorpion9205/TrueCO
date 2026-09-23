import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit, bodyFieldKey } from '../../common/middleware/rate-limit.middleware.js';

/** Minimal in-memory stand-in for the ioredis MULTI(INCR, EXPIRE NX, TTL) pipeline. */
function createFakeRedis(status = 'ready') {
  const counters = new Map<string, number>();
  const fake = {
    status,
    counters,
    multi() {
      const ops: Array<() => [null, number]> = [];
      const chain = {
        incr(key: string) {
          ops.push(() => {
            const next = (counters.get(key) ?? 0) + 1;
            counters.set(key, next);
            return [null, next];
          });
          return chain;
        },
        expire() {
          ops.push(() => [null, 1]);
          return chain;
        },
        ttl() {
          ops.push(() => [null, 42]);
          return chain;
        },
        async exec() {
          return ops.map((op) => op());
        },
      };
      return chain;
    },
  };
  return fake;
}

function buildApp(limiter: express.RequestHandler, trustProxy: boolean | number = false) {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.use(express.json());
  app.post('/target', limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rateLimit middleware', () => {
  it('allows requests up to the limit, then returns 429 with Retry-After', async () => {
    const redis = createFakeRedis();
    const app = buildApp(rateLimit({ name: 'test', windowSeconds: 60, max: 2, redis: () => redis as any }));

    expect((await request(app).post('/target')).status).toBe(200);
    expect((await request(app).post('/target')).status).toBe(200);

    const blocked = await request(app).post('/target');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBe('42');
  });

  it('ignores a spoofed X-Forwarded-For when no proxy is trusted', async () => {
    const redis = createFakeRedis();
    const app = buildApp(rateLimit({ name: 'spoof', windowSeconds: 60, max: 1, redis: () => redis as any }));

    expect((await request(app).post('/target').set('X-Forwarded-For', '1.1.1.1')).status).toBe(200);
    expect((await request(app).post('/target').set('X-Forwarded-For', '2.2.2.2')).status).toBe(429);
  });

  it('keys on a request body field when configured', async () => {
    const redis = createFakeRedis();
    const app = buildApp(
      rateLimit({ name: 'otp', windowSeconds: 60, max: 1, keyGenerator: bodyFieldKey('identifier'), redis: () => redis as any }),
    );

    expect((await request(app).post('/target').send({ identifier: 'a@x.in' })).status).toBe(200);
    expect((await request(app).post('/target').send({ identifier: 'A@x.in' })).status).toBe(429);
    expect((await request(app).post('/target').send({ identifier: 'b@x.in' })).status).toBe(200);
  });

  it('fails open when Redis is not connected', async () => {
    const redis = createFakeRedis('connecting');
    const app = buildApp(rateLimit({ name: 'down', windowSeconds: 60, max: 0, redis: () => redis as any }));

    expect((await request(app).post('/target')).status).toBe(200);
  });
});
