import { queueRegistry } from '../../queues/queue.registry.js';
import { logger } from '../logger/logger.service.js';

export interface IAccountLockoutService {
  isLocked(identifier: string): Promise<{ locked: boolean; remainingSeconds?: number }>;
  recordFailedAttempt(identifier: string): Promise<{ locked: boolean; attempts: number }>;
  resetAttempts(identifier: string): Promise<void>;
}

export class AccountLockoutService implements IAccountLockoutService {
  private static instance: AccountLockoutService;
  private readonly maxAttempts = 5;
  private readonly lockDurationSeconds = 15 * 60; // 15 minutes

  public static getInstance(): AccountLockoutService {
    if (!AccountLockoutService.instance) {
      AccountLockoutService.instance = new AccountLockoutService();
    }
    return AccountLockoutService.instance;
  }

  private getKey(identifier: string): string {
    return `auth:lockout:${identifier.toLowerCase().trim()}`;
  }

  public async isLocked(identifier: string): Promise<{ locked: boolean; remainingSeconds?: number }> {
    try {
      const redis = queueRegistry.getRedisClient();
      const key = this.getKey(identifier);
      const attemptsStr = await redis.get(key);

      if (!attemptsStr) {
        return { locked: false };
      }

      const attempts = parseInt(attemptsStr, 10);
      if (attempts >= this.maxAttempts) {
        const ttl = await redis.ttl(key);
        return { locked: true, remainingSeconds: ttl > 0 ? ttl : 0 };
      }

      return { locked: false };
    } catch (err) {
      logger.error('[AccountLockoutService] Redis query failed:', err);
      return { locked: false }; // Fail open for rate limiter to avoid blocking all users on Redis hiccup
    }
  }

  public async recordFailedAttempt(identifier: string): Promise<{ locked: boolean; attempts: number }> {
    try {
      const redis = queueRegistry.getRedisClient();
      const key = this.getKey(identifier);
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, this.lockDurationSeconds);
      }

      const locked = current >= this.maxAttempts;
      if (locked) {
        logger.warn(`[AccountLockoutService] Account locked due to excessive failures: ${identifier}`, {
          attempts: current,
        });
      }

      return { locked, attempts: current };
    } catch (err) {
      logger.error('[AccountLockoutService] Error recording failed attempt:', err);
      return { locked: false, attempts: 1 };
    }
  }

  public async resetAttempts(identifier: string): Promise<void> {
    try {
      const redis = queueRegistry.getRedisClient();
      const key = this.getKey(identifier);
      await redis.del(key);
    } catch (err) {
      logger.error('[AccountLockoutService] Error resetting attempts:', err);
    }
  }
}

export const accountLockoutService = AccountLockoutService.getInstance();
