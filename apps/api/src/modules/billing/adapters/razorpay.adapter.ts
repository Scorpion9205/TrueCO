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

export class RazorpayAdapter implements IPaymentGatewayAdapter {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string = 'https://api.razorpay.com/v1';

  public constructor() {
    this.keyId = envConfig.get('RAZORPAY_KEY_ID') || '';
    this.keySecret = envConfig.get('RAZORPAY_KEY_SECRET') || '';
    this.webhookSecret = envConfig.get('RAZORPAY_WEBHOOK_SECRET') || '';
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  public async createOrder(input: CreateOrderInput): Promise<PaymentOrderResult> {
    if (!this.keyId || !this.keySecret) {
      logger.warn('[RazorpayAdapter] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set, returning mock order');
      const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
      return {
        orderId,
        amount: input.amount,
        currency: input.currency || 'INR',
        keyId: this.keyId || 'mock_key',
        receipt: input.receipt,
      };
    }

    // Razorpay amounts are represented in the smallest currency unit (e.g. paise for INR: 100 paise = ₹1)
    const amountInPaise = Math.round(input.amount * 100);

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: input.currency || 'INR',
        receipt: input.receipt,
        notes: input.notes,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[RazorpayAdapter] Failed to create order: ${response.status} ${errorText}`);
      throw new Error(`Failed to create Razorpay order: ${errorText}`);
    }

    const data = (await response.json()) as any;
    return {
      orderId: data.id,
      amount: input.amount,
      currency: data.currency || input.currency || 'INR',
      keyId: this.keyId,
      receipt: input.receipt,
    };
  }

  public async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult> {
    if (!this.keyId || !this.keySecret) {
      logger.warn('[RazorpayAdapter] RAZORPAY credentials missing, returning mock payment link');
      const paymentLinkId = `plink_mock_${crypto.randomBytes(8).toString('hex')}`;
      return {
        paymentLinkId,
        shortUrl: `https://rzp.io/i/mock_${paymentLinkId}`,
        amount: input.amount,
        status: 'created',
      };
    }

    const amountInPaise = Math.round(input.amount * 100);

    const response = await fetch(`${this.baseUrl}/payment_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: input.currency || 'INR',
        description: input.description,
        customer: {
          name: input.customer.name,
          email: input.customer.email,
          contact: input.customer.contact,
        },
        reference_id: input.referenceId,
        notes: input.notes,
        notify: {
          sms: true,
          email: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[RazorpayAdapter] Failed to create payment link: ${response.status} ${errorText}`);
      throw new Error(`Failed to create Razorpay payment link: ${errorText}`);
    }

    const data = (await response.json()) as any;
    return {
      paymentLinkId: data.id,
      shortUrl: data.short_url,
      amount: input.amount,
      status: data.status,
    };
  }

  public verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret?: string,
  ): boolean {
    const webhookSecret = secret || this.webhookSecret;
    if (!webhookSecret) {
      if (isUnsignedWebhookAllowed()) return true;
      logger.error('[RazorpayAdapter] RAZORPAY_WEBHOOK_SECRET is not configured; rejecting webhook');
      return false;
    }

    return safeEqual(signature, hmacSha256Hex(payload, webhookSecret));
  }
}
