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
  // Local in-memory fallback if Redis is unreachable or during unit tests
  private readonly memoryStore: Map<string, { code: string; expiresAt: number }> = new Map();

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
    this.memoryStore.set(key, { code, expiresAt });

    // Save to Redis if available and connected
    if (envConfig.get('NODE_ENV') !== 'test') {
      try {
        const redis = queueRegistry.getRedisClient();
        if (redis.status === 'ready') {
          await redis.setex(key, ttlSeconds, code);
        }
      } catch {
        // Redis optional in local dev mode
      }
    }

    // High-visibility terminal output for developers
    this.printDevOtpBanner(identifier, code, purpose, ttlSeconds);

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
          if (stored && stored === cleanCode) {
            await redis.del(key);
            this.memoryStore.delete(key);
            return true;
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
    }

    return false;
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

    // Always output directly to stdout for instant developer visibility
    console.log('\x1b[36m%s\x1b[0m', banner);
    logger.info(`[OtpService] OTP generated for ${identifier} [${purpose}]: ${code}`);
  }
}

export const otpService = OtpService.getInstance();
