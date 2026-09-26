import { Request, Response, NextFunction, RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Redis } from 'ioredis';
import { ApiErrorResponse } from '@vargly/types';
import { queueRegistry } from '../../queues/queue.registry.js';
import { logger } from '../logger/logger.service.js';

export interface RateLimitOptions {
  /** Unique bucket name, e.g. "auth-login" */
  readonly name: string;
  readonly windowSeconds: number;
  readonly max: number;
  /** Defaults to the client IP (which honours the TRUST_PROXY setting) */
  readonly keyGenerator?: (req: Request) => string | undefined;
  /** Injectable for tests; defaults to the shared Redis connection */
  readonly redis?: () => Redis;
}

/**
 * Fixed-window rate limiter backed by Redis so limits hold across API replicas.
 * Fails open when Redis is unavailable (consistent with AccountLockoutService),
 * so a Redis outage degrades protection rather than taking authentication down.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  const getRedis = options.redis ?? (() => queueRegistry.getRedisClient());
  const keyGenerator = options.keyGenerator ?? ((req: Request) => req.ip);

  const handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const subject = keyGenerator(req);
    if (!subject) return next();

    let count: number;
    let ttl: number;
    try {
      const redis = getRedis();
      if (redis.status !== 'ready') return next();

      const key = `ratelimit:${options.name}:${subject.toLowerCase()}`;
      const results = await redis.multi().incr(key).expire(key, options.windowSeconds, 'NX').ttl(key).exec();
      count = Number(results?.[0]?.[1] ?? 0);
      ttl = Number(results?.[2]?.[1] ?? options.windowSeconds);
    } catch (err) {
      logger.warn(`[RateLimit] ${options.name}: Redis unavailable, allowing request`, { error: (err as Error).message });
      return next();
    }

    const retryAfter = ttl > 0 ? ttl : options.windowSeconds;
    res.setHeader('RateLimit-Limit', options.max);
    res.setHeader('RateLimit-Remaining', Math.max(0, options.max - count));
    res.setHeader('RateLimit-Reset', retryAfter);

    if (count > options.max) {
      res.setHeader('Retry-After', retryAfter);
      const body: ApiErrorResponse = {
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Try again in ${retryAfter} seconds.`,
          // Lets the app say how long to wait (the limits run from one minute to an hour)
          details: { retryAfterSeconds: retryAfter },
        },
      };
      res.status(StatusCodes.TOO_MANY_REQUESTS).json(body);
      return;
    }

    next();
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    handle(req, res, next).catch(next);
  };
}

/** Keys a limiter on a normalised request-body field, e.g. the email or phone being targeted. */
export function bodyFieldKey(field: string): (req: Request) => string | undefined {
  return (req: Request) => {
    const value = req.body?.[field];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
}
