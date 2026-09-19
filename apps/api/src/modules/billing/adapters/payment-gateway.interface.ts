export interface CreateOrderInput {
  readonly amount: number; // In currency units (e.g. INR rupees or smallest unit)
  readonly currency?: string; // Default 'INR'
  readonly receipt: string;
  readonly notes?: Record<string, string>;
}

export interface PaymentOrderResult {
  readonly orderId: string;
  readonly amount: number;
  readonly currency: string;
  readonly keyId?: string;
  readonly receipt: string;
}

export interface CreatePaymentLinkInput {
  readonly amount: number;
  readonly currency?: string;
  readonly description: string;
  readonly customer: {
    readonly name: string;
    readonly email?: string;
    readonly contact?: string;
  };
  readonly referenceId: string;
  readonly notes?: Record<string, string>;
}

export interface PaymentLinkResult {
  readonly paymentLinkId: string;
  readonly shortUrl: string;
  readonly amount: number;
  readonly status: string;
}

export interface IPaymentGatewayAdapter {
  createOrder(input: CreateOrderInput): Promise<PaymentOrderResult>;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult>;
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret?: string): boolean;
}
