import crypto from 'node:crypto';
import { queueRegistry } from '../../queues/queue.registry.js';
import { logger } from '../logger/logger.service.js';
import { envConfig } from '../../config/env.config.js';

export interface IOtpService {
  generateOtp(
    identifier: string,
    purpose?: 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | 'VERIFY_PHONE' | string,
    ttlSeconds?: number,
  ): Promise<string>;

  verifyOtp(
    identifier: string,
    code: string,
    purpose?: 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | 'VERIFY_PHONE' | string,
  ): Promise<boolean>;
}

export class OtpService implements IOtpService {
  private static instance: OtpService;
  /** Wrong guesses allowed before the code is burned (6 digits must not be brute-forceable) */
  public static readonly MAX_VERIFY_ATTEMPTS = 5;
  // Local in-memory fallback if Redis is unreachable or during unit tests
  private readonly memoryStore: Map<string, { code: string; expiresAt: number; attempts: number }> = new Map();

  public static getInstance(): OtpService {
    if (!OtpService.instance) {
      OtpService.instance = new OtpService();
    }
    return OtpService.instance;
  }

  private getKey(identifier: string, purpose: string): string {
    return `auth:otp:${purpose.toUpperCase()}:${identifier.toLowerCase().trim()}`;
  }

  public async generateOtp(
    identifier: string,
    purpose: string = 'SIGNUP',
    ttlSeconds: number = 600, // 10 minutes default
  ): Promise<string> {
    // Generate secure 6-digit numeric code
    const code = crypto.randomInt(100000, 999999).toString();
    const key = this.getKey(identifier, purpose);
    const expiresAt = Date.now() + ttlSeconds * 1000;

    // Save to memory fallback
    this.memoryStore.set(key, { code, expiresAt, attempts: 0 });

    // Save to Redis if available and connected
    if (envConfig.get('NODE_ENV') !== 'test') {
      try {
        const redis = queueRegistry.getRedisClient();
        if (redis.status === 'ready') {
          await redis.multi().setex(key, ttlSeconds, code).del(this.getAttemptsKey(key)).exec();
        }
      } catch {
        // Redis optional in local dev mode
      }
    }

    // OTPs are credentials: only ever surface them on a local development terminal
    if (envConfig.get('NODE_ENV') === 'development') {
      this.printDevOtpBanner(identifier, code, purpose, ttlSeconds);
    }

    return code;
  }

  public async verifyOtp(
    identifier: string,
    code: string,
    purpose: string = 'SIGNUP',
  ): Promise<boolean> {
    const key = this.getKey(identifier, purpose);
    const cleanCode = code.trim();

    // 1. Try Redis if connected
    if (envConfig.get('NODE_ENV') !== 'test') {
      try {
        const redis = queueRegistry.getRedisClient();
        if (redis.status === 'ready') {
          const stored = await redis.get(key);
          if (stored) {
            if (stored === cleanCode) {
              await redis.del(key, this.getAttemptsKey(key));
              this.memoryStore.delete(key);
              return true;
            }
            await this.recordFailedRedisAttempt(key);
            return false;
          }
        }
      } catch {
        // fallback to memory
      }
    }

    // 2. Try Memory fallback
    const memEntry = this.memoryStore.get(key);
    if (memEntry) {
      if (Date.now() > memEntry.expiresAt) {
        this.memoryStore.delete(key);
        return false;
      }
      if (memEntry.code === cleanCode) {
        this.memoryStore.delete(key);
        return true;
      }
      memEntry.attempts += 1;
      if (memEntry.attempts >= OtpService.MAX_VERIFY_ATTEMPTS) {
        this.memoryStore.delete(key);
        logger.warn(`[OtpService] OTP invalidated after ${memEntry.attempts} failed attempts`);
      }
    }

    return false;
  }

  private getAttemptsKey(key: string): string {
    return `${key}:attempts`;
  }

  private async recordFailedRedisAttempt(key: string): Promise<void> {
    const redis = queueRegistry.getRedisClient();
    const attemptsKey = this.getAttemptsKey(key);
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      const ttl = await redis.ttl(key);
      await redis.expire(attemptsKey, ttl > 0 ? ttl : 600);
    }
    if (attempts >= OtpService.MAX_VERIFY_ATTEMPTS) {
      await redis.del(key, attemptsKey);
      this.memoryStore.delete(key);
      logger.warn(`[OtpService] OTP invalidated after ${attempts} failed attempts`);
    }
  }

  private printDevOtpBanner(
    identifier: string,
    code: string,
    purpose: string,
    ttlSeconds: number,
  ): void {
    const banner = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║                    🔑 TRUECO DEV OTP                         ║',
      '╠══════════════════════════════════════════════════════════════╣',
      `║  Target:   ${identifier.padEnd(46)}║`,
      `║  Code:     >>> ${code} <<<${' '.repeat(34)}║`,
      `║  Purpose:  ${purpose.padEnd(46)}║`,
      `║  Validity: ${ttlSeconds} seconds (${Math.round(ttlSeconds / 60)} min)${' '.repeat(30)}║`,
      '╚══════════════════════════════════════════════════════════════╝',
      '',
    ].join('\n');

    // stdout only: never route OTPs through the structured logger, which is shipped to log storage
    console.log('\x1b[36m%s\x1b[0m', banner);
  }
}

export const otpService = OtpService.getInstance();
