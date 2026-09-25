import { invalidateSubscriptionFeatureCache } from '../../common/decorators/require-feature.decorator.js';
import { RequestContextService } from '../../common/services/request-context.service.js';
import { isUuid } from '../../common/validation/is-uuid.js';
import { StatusCodes } from 'http-status-codes';
import { BillingCycle, IBillingRepository } from './billing.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  BillingPaymentResponseDto,
  PlanResponseDto,
  SubscriptionResponseDto,
} from './dto/billing.dto.js';
import { BillingMapper } from './billing.mapper.js';
import {
  createAiCreditsPurchasedEvent,
  createSubscriptionUpgradedEvent,
} from './billing.events.js';
import { PlanCode, SubscriptionStatus } from '@trueco/types';
import { toPaise } from '../../common/money/money.js';
import { IPaymentGatewayAdapter, PaymentOrderResult } from './adapters/payment-gateway.interface.js';
import { MockPaymentGatewayAdapter } from './adapters/mock-payment-gateway.adapter.js';
import { RazorpayAdapter } from './adapters/razorpay.adapter.js';
import { envConfig } from '../../config/env.config.js';
import { logger } from '../../common/logger/logger.service.js';
import { paymentReconcileTotal } from '../../common/metrics/metrics.service.js';
import { isUnsignedWebhookAllowed } from '../../common/security/webhook-signature.js';

export interface CreateBillingOrderDto {
  readonly type: 'PLAN_UPGRADE' | 'AI_CREDITS';
  readonly planCode?: PlanCode;
  readonly billingCycle?: BillingCycle;
  readonly credits?: number;
}

export class BillingService {
  private readonly paymentAdapter: IPaymentGatewayAdapter;

  public constructor(
    private readonly billingRepository: IBillingRepository,
    private readonly eventBus: IEventBus,
    paymentAdapter?: IPaymentGatewayAdapter,
  ) {
    this.paymentAdapter =
      paymentAdapter ||
      (envConfig.get('RAZORPAY_KEY_ID') ? new RazorpayAdapter() : new MockPaymentGatewayAdapter());
  }

  public async getCurrentSubscription(coachingId: string): Promise<SubscriptionResponseDto> {
    const sub = await this.billingRepository.findCurrentSubscription(coachingId);
    if (!sub) {
      throw new AppError('SUBSCRIPTION_NOT_FOUND', 'No active subscription found', StatusCodes.NOT_FOUND);
    }

    const wallet = await this.billingRepository.getCreditWallet(coachingId);
    return BillingMapper.toSubscriptionDto(sub, wallet, envConfig.get('AI_CREDIT_PRICE_PAISE'));
  }

  public async listPayments(coachingId: string): Promise<BillingPaymentResponseDto[]> {
    const payments = await this.billingRepository.listPayments(coachingId, 50);
    return payments.map(BillingMapper.toPaymentDto);
  }

  /** Real payments need a gateway: the mock one is for development and tests */
  public get isMockGateway(): boolean {
    return this.paymentAdapter instanceof MockPaymentGatewayAdapter || !envConfig.get('RAZORPAY_KEY_ID');
  }

  /**
   * Development only: settles one of this coaching's own orders as if the gateway had reported
   * it paid, so the purchase flow can be tried without Razorpay keys. Refused whenever a real
   * gateway is configured or in production.
   */
  public async simulatePayment(orderId: string, coachingId: string): Promise<{ status: string }> {
    if (!this.isMockGateway || !isUnsignedWebhookAllowed()) {
      throw new AppError('NOT_AVAILABLE', 'Simulated payments are not available', StatusCodes.NOT_FOUND);
    }
    const payment = await this.billingRepository.findPaymentByOrderId(orderId);
    if (!payment || payment.coachingId !== coachingId) {
      throw new AppError('ORDER_NOT_FOUND', 'Order not found', StatusCodes.NOT_FOUND);
    }
    return this.settleOrder(coachingId, orderId, {
      id: `pay_mock_${crypto.randomUUID().replaceAll('-', '').slice(0, 14)}`,
      amount: payment.amountPaise,
      created_at: Math.floor(Date.now() / 1000),
    });
  }

  public async getPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.billingRepository.findAllActivePlans();
    return plans.map(BillingMapper.toPlanDto);
  }

  /**
   * Starts a purchase. The price is always computed here from the plan or credit pack; the
   * client only says what it wants to buy. Nothing is granted until the payment webhook
   * settles the order.
   */
  public async createOrder(
    dto: CreateBillingOrderDto,
    coachingId: string,
    userId?: string,
  ): Promise<PaymentOrderResult> {
    let amountPaise: number;
    if (dto.type === 'PLAN_UPGRADE') {
      const plan = dto.planCode ? await this.billingRepository.findPlanByCode(dto.planCode) : null;
      if (!plan || !plan.isActive) {
        throw new AppError('PLAN_NOT_FOUND', `Plan "${dto.planCode}" does not exist`, StatusCodes.NOT_FOUND);
      }
      const price = dto.billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
      amountPaise = toPaise(price);
      if (amountPaise <= 0) {
        throw new AppError('PLAN_NOT_PURCHASABLE', `Plan "${dto.planCode}" cannot be purchased`, StatusCodes.BAD_REQUEST);
      }
    } else {
      amountPaise = (dto.credits ?? 0) * envConfig.get('AI_CREDIT_PRICE_PAISE');
    }

    const order = await this.paymentAdapter.createOrder({
      amount: amountPaise / 100,
      currency: 'INR',
      receipt: `sub_${coachingId.slice(0, 8)}_${Date.now()}`,
      // Informational for the Razorpay dashboard; settlement uses the stored order record
      notes: { coachingId, type: dto.type },
    });

    await this.billingRepository.createPaymentRecord({
      coachingId,
      type: dto.type,
      planCode: dto.type === 'PLAN_UPGRADE' ? dto.planCode : undefined,
      billingCycle: dto.type === 'PLAN_UPGRADE' ? dto.billingCycle : undefined,
      credits: dto.type === 'AI_CREDITS' ? dto.credits : undefined,
      amountPaise,
      gatewayOrderId: order.orderId,
      createdBy: userId,
    });

    return order;
  }

  public async handleWebhook(
    payload: any,
    signature: string,
    rawBody?: Buffer | string,
  ): Promise<{ status: string }> {
    const isValid = this.paymentAdapter.verifyWebhookSignature(
      rawBody || JSON.stringify(payload),
      signature,
    );
    if (!isValid) {
      throw new AppError('INVALID_SIGNATURE', 'Payment webhook HMAC verification failed', StatusCodes.UNAUTHORIZED);
    }

    const eventName = payload.event;
    if (eventName !== 'payment.captured' && eventName !== 'order.paid') {
      return { status: 'IGNORED' };
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const orderId: string | undefined = paymentEntity?.order_id ?? payload.payload?.order?.entity?.id;
    const coachingId = paymentEntity?.notes?.coachingId ?? payload.payload?.order?.entity?.notes?.coachingId;
    if (!orderId || !paymentEntity?.id || !isUuid(coachingId)) {
      // Not a TrueCO subscription order (e.g. a fee payment link): nothing to settle here
      return { status: 'IGNORED' };
    }

    logger.info(`[BillingService] Settling order ${orderId} from ${eventName}`);
    // Webhooks carry no session: act as the coaching named in the signed payload. The order
    // record is tenant-scoped, so a payload naming the wrong coaching finds nothing.
    return RequestContextService.runForTenant(coachingId, () =>
      this.settleOrder(coachingId, orderId, paymentEntity),
    );
  }

  private async settleOrder(coachingId: string, orderId: string, paymentEntity: any): Promise<{ status: string }> {
    const result = await this.billingRepository.settlePayment({
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentEntity.id,
      amountPaidPaise: Number(paymentEntity.amount),
      paidAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000) : new Date(),
    });

    switch (result.kind) {
      case 'not_found':
        logger.warn(`[BillingService] Webhook for unknown order ${orderId}`);
        return { status: 'IGNORED' };
      case 'duplicate':
        // payment.captured and order.paid both arrive for one payment, and gateways retry
        return { status: 'DUPLICATE' };
      case 'amount_mismatch':
        paymentReconcileTotal.inc({ source: 'billing', reason: 'AMOUNT_MISMATCH' });
        logger.error('[BillingService] RECONCILE: paid amount differs from the order price; nothing applied', undefined, {
          orderId,
          expectedPaise: result.payment.amountPaise,
          paidPaise: paymentEntity.amount,
          coachingId,
        });
        return { status: 'REJECTED' };
    }

    const { payment, subscription, creditsAdded, walletBalance } = result;
    await invalidateSubscriptionFeatureCache(coachingId);

    if (payment.type === 'PLAN_UPGRADE' && subscription) {
      await this.eventBus.publish(
        createSubscriptionUpgradedEvent(
          {
            coachingId,
            newPlan: payment.planCode,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: subscription.currentPeriodEnd,
          },
          crypto.randomUUID(),
          payment.createdBy ?? undefined,
        ),
      );
    }
    if (creditsAdded > 0) {
      await this.eventBus.publish(
        createAiCreditsPurchasedEvent(
          { coachingId, creditsAdded, newBalance: walletBalance },
          crypto.randomUUID(),
          payment.createdBy ?? undefined,
        ),
      );
    }

    return { status: 'PROCESSED' };
  }

}
