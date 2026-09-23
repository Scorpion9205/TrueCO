import { describe, it, expect, afterEach, vi } from 'vitest';
import { envConfig } from '../../config/env.config.js';
import { hmacSha256Hex, safeEqual } from '../../common/security/webhook-signature.js';
import { RazorpayAdapter } from '../../modules/billing/adapters/razorpay.adapter.js';
import { MockPaymentGatewayAdapter } from '../../modules/billing/adapters/mock-payment-gateway.adapter.js';

function stubEnv(overrides: Record<string, unknown>): void {
  const realGet = envConfig.get.bind(envConfig);
  vi.spyOn(envConfig, 'get').mockImplementation(((key: string) =>
    key in overrides ? overrides[key] : realGet(key as any)) as any);
}

const payload = JSON.stringify({ event: 'payment.captured' });

describe('webhook signature verification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('safeEqual handles equal, different and mismatched-length inputs', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('Razorpay accepts a valid HMAC and rejects a forged one', () => {
    stubEnv({ NODE_ENV: 'production', RAZORPAY_WEBHOOK_SECRET: 'whsec_test' });
    const adapter = new RazorpayAdapter();

    expect(adapter.verifyWebhookSignature(payload, hmacSha256Hex(payload, 'whsec_test'))).toBe(true);
    expect(adapter.verifyWebhookSignature(payload, hmacSha256Hex(payload, 'wrong'))).toBe(false);
  });

  it('Razorpay rejects every webhook in production when no secret is configured', () => {
    stubEnv({ NODE_ENV: 'production', RAZORPAY_WEBHOOK_SECRET: undefined });
    const adapter = new RazorpayAdapter();

    expect(adapter.verifyWebhookSignature(payload, 'anything')).toBe(false);
  });

  it('mock gateway never trusts a webhook in production, including magic test signatures', () => {
    stubEnv({ NODE_ENV: 'production' });
    const adapter = new MockPaymentGatewayAdapter();

    expect(adapter.verifyWebhookSignature(payload, 'any-signature')).toBe(false);
    expect(adapter.verifyWebhookSignature(payload, 'signature')).toBe(false);
  });
});
