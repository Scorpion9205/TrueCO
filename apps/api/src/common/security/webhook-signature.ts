import crypto from 'node:crypto';
import { envConfig } from '../../config/env.config.js';

export function hmacSha256Hex(payload: string | Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time string comparison that tolerates length mismatches. */
export function safeEqual(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Webhooks without a configured secret can only be accepted outside production.
 * In production a missing secret means the request cannot be authenticated, so it is rejected.
 */
export function isUnsignedWebhookAllowed(): boolean {
  return envConfig.get('NODE_ENV') !== 'production';
}
