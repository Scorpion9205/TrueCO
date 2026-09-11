import crypto from 'crypto';
import { QueueRegistry } from '../../../queues/queue.registry.js';
import { logger } from '../../../common/logger/logger.service.js';

export interface IPromptCache {
  computeHash(input: unknown): string;
  get(coachingId: string, feature: string, inputHash: string): Promise<string | null>;
  set(
    coachingId: string,
    feature: string,
    inputHash: string,
    content: string,
    ttlSeconds?: number,
  ): Promise<void>;
  clear(coachingId: string, feature?: string): Promise<void>;
}

export class RedisPromptCache implements IPromptCache {
  private readonly inMemoryFallback = new Map<string, { content: string; expiresAt: number }>();
  private readonly defaultTtlSeconds = 86400; // 24 hours

  public computeHash(input: unknown): string {
    const rawString = typeof input === 'string' ? input : JSON.stringify(input);
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  private buildKey(coachingId: string, feature: string, inputHash: string): string {
    return `ai_cache:${coachingId}:${feature}:${inputHash}`;
  }

  public async get(
    coachingId: string,
    feature: string,
    inputHash: string,
  ): Promise<string | null> {
    const key = this.buildKey(coachingId, feature, inputHash);

    try {
      const redis = QueueRegistry.getInstance().getRedisClient();
      if (redis && redis.status === 'ready') {
        const cached = await redis.get(key);
        if (cached) {
          logger.debug(`[RedisPromptCache] Cache HIT for key: ${key}`);
          return cached;
        }
      }
    } catch (err) {
      logger.warn('[RedisPromptCache] Redis get error, checking in-memory fallback', { error: String(err) });
    }

    // In-memory fallback
    const memEntry = this.inMemoryFallback.get(key);
    if (memEntry) {
      if (Date.now() < memEntry.expiresAt) {
        logger.debug(`[RedisPromptCache] In-memory fallback cache HIT for: ${key}`);
        return memEntry.content;
      }
      this.inMemoryFallback.delete(key);
    }

    return null;
  }

  public async set(
    coachingId: string,
    feature: string,
    inputHash: string,
    content: string,
    ttlSeconds: number = this.defaultTtlSeconds,
  ): Promise<void> {
    const key = this.buildKey(coachingId, feature, inputHash);

    try {
      const redis = QueueRegistry.getInstance().getRedisClient();
      if (redis && redis.status === 'ready') {
        await redis.set(key, content, 'EX', ttlSeconds);
        logger.debug(`[RedisPromptCache] Cached completion in Redis for key: ${key} (TTL: ${ttlSeconds}s)`);
        return;
      }
    } catch (err) {
      logger.warn('[RedisPromptCache] Redis set error, storing in in-memory fallback', { error: String(err) });
    }

    // In-memory fallback
    this.inMemoryFallback.set(key, {
      content,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async clear(coachingId: string, feature?: string): Promise<void> {
    try {
      const redis = QueueRegistry.getInstance().getRedisClient();
      if (redis && redis.status === 'ready') {
        const pattern = feature
          ? `ai_cache:${coachingId}:${feature}:*`
          : `ai_cache:${coachingId}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.info(`[RedisPromptCache] Cleared ${keys.length} cached keys for coaching: ${coachingId}`);
        }
      }
    } catch (err) {
      logger.warn('[RedisPromptCache] Redis clear error', { error: String(err) });
    }

    const prefix = feature ? `ai_cache:${coachingId}:${feature}:` : `ai_cache:${coachingId}:`;
    for (const k of this.inMemoryFallback.keys()) {
      if (k.startsWith(prefix)) {
        this.inMemoryFallback.delete(k);
      }
    }
  }
}
