import crypto from 'node:crypto';
import {
  IPaymentGatewayAdapter,
  CreateOrderInput,
  PaymentOrderResult,
  CreatePaymentLinkInput,
  PaymentLinkResult,
} from './payment-gateway.interface.js';
import { envConfig } from '../../../config/env.config.js';
import { logger } from '../../../common/logger/logger.service.js';
import { hmacSha256Hex, isUnsignedWebhookAllowed, safeEqual } from '../../../common/security/webhook-signature.js';

export class MockPaymentGatewayAdapter implements IPaymentGatewayAdapter {
  public async createOrder(input: CreateOrderInput): Promise<PaymentOrderResult> {
    const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    const keyId = envConfig.get('RAZORPAY_KEY_ID') || 'rzp_test_mockkey123';

    return {
      orderId,
      amount: input.amount,
      currency: input.currency || 'INR',
      keyId,
      receipt: input.receipt,
      mock: true,
    };
  }

  public async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
    const paymentLinkId = `plink_mock_${crypto.randomBytes(8).toString('hex')}`;
    const baseUrl = envConfig.get('API_BASE_URL') || 'http://localhost:4000';

    return {
      paymentLinkId,
      shortUrl: `${baseUrl}/pay/${paymentLinkId}`,
      amount: input.amount,
      status: 'created',
    };
  }

  public verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret?: string,
  ): boolean {
    // The mock gateway is never a trusted payment source in production.
    if (!isUnsignedWebhookAllowed()) {
      logger.error('[MockPaymentGateway] Rejecting webhook: mock gateway is active in production (set RAZORPAY_KEY_ID)');
      return false;
    }
    if (signature === 'invalid-signature') {
      return false;
    }
    if (envConfig.get('NODE_ENV') === 'test') {
      return true;
    }

    const webhookSecret = secret || envConfig.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) return true;
    return safeEqual(signature, hmacSha256Hex(payload, webhookSecret));
  }
}
