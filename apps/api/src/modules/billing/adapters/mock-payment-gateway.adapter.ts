import crypto from 'node:crypto';
import {
  IPaymentGatewayAdapter,
  CreateOrderInput,
  PaymentOrderResult,
  CreatePaymentLinkInput,
  PaymentLinkResult,
} from './payment-gateway.interface.js';
import { envConfig } from '../../../config/env.config.js';

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
    if (signature === 'invalid-signature') {
      return false;
    }
    // In test suite or mock mode, accept mock/test signatures
    if (envConfig.get('NODE_ENV') === 'test' || signature === 'any-signature' || signature === 'signature') {
      return true;
    }

    const webhookSecret = secret || envConfig.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) return true; // dev bypass if not configured

    try {
      const raw = typeof payload === 'string' ? payload : payload.toString('utf-8');
      const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
