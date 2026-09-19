import { StatusCodes } from 'http-status-codes';
import { IBillingRepository } from './billing.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  PlanResponseDto,
  PurchaseCreditsDto,
  SubscriptionResponseDto,
  UpgradePlanDto,
} from './dto/billing.dto.js';
import { BillingMapper } from './billing.mapper.js';
import {
  createAiCreditsPurchasedEvent,
  createSubscriptionUpgradedEvent,
} from './billing.events.js';
import { SubscriptionStatus } from '@trueco/types';
import { IPaymentGatewayAdapter, PaymentOrderResult } from './adapters/payment-gateway.interface.js';
import { MockPaymentGatewayAdapter } from './adapters/mock-payment-gateway.adapter.js';
import { RazorpayAdapter } from './adapters/razorpay.adapter.js';
import { envConfig } from '../../config/env.config.js';
import { logger } from '../../common/logger/logger.service.js';

export interface CreateBillingOrderDto {
  readonly type: 'PLAN_UPGRADE' | 'AI_CREDITS';
  readonly planCode?: string;
  readonly billingCycle?: 'MONTHLY' | 'ANNUAL';
  readonly credits?: number;
  readonly amount: number;
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
    return BillingMapper.toSubscriptionDto(sub, wallet);
  }

  public async getPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.billingRepository.findAllActivePlans();
    return plans.map(BillingMapper.toPlanDto);
  }

  public async upgradePlan(
    dto: UpgradePlanDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<SubscriptionResponseDto> {
    const targetPlan = await this.billingRepository.findPlanByCode(dto.planCode);
    if (!targetPlan) {
      throw new AppError('PLAN_NOT_FOUND', `Plan "${dto.planCode}" does not exist`, StatusCodes.NOT_FOUND);
    }

    const now = new Date();
    const currentPeriodEnd = new Date(now);
    if (dto.billingCycle === 'MONTHLY') {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    } else {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 365);
    }

    const updatedSub = await this.billingRepository.updateSubscriptionPlan(
      coachingId,
      targetPlan.id,
      SubscriptionStatus.ACTIVE,
      currentPeriodEnd,
    );

    // Grant default plan credits if any
    if (targetPlan.defaultCredits > 0) {
      await this.billingRepository.addCredits(coachingId, targetPlan.defaultCredits);
    }

    const wallet = await this.billingRepository.getCreditWallet(coachingId);
    const responseDto = BillingMapper.toSubscriptionDto(updatedSub, wallet);

    await this.eventBus.publish(
      createSubscriptionUpgradedEvent(
        {
          coachingId,
          newPlan: dto.planCode,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async purchaseCredits(
    dto: PurchaseCreditsDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<{ newBalance: number }> {
    const updatedWallet = await this.billingRepository.addCredits(coachingId, dto.credits);

    await this.eventBus.publish(
      createAiCreditsPurchasedEvent(
        {
          coachingId,
          creditsAdded: dto.credits,
          newBalance: updatedWallet.balance,
        },
        correlationId,
        userId,
      ),
    );

    return { newBalance: updatedWallet.balance };
  }

  public async createOrder(
    dto: CreateBillingOrderDto,
    coachingId: string,
  ): Promise<PaymentOrderResult> {
    const receipt = `sub_${coachingId.slice(0, 8)}_${Date.now()}`;
    const notes: Record<string, string> = {
      coachingId,
      type: dto.type,
      ...(dto.planCode ? { planCode: dto.planCode } : {}),
      ...(dto.billingCycle ? { billingCycle: dto.billingCycle } : {}),
      ...(dto.credits ? { credits: String(dto.credits) } : {}),
    };

    return this.paymentAdapter.createOrder({
      amount: dto.amount,
      currency: 'INR',
      receipt,
      notes,
    });
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
    logger.info(`[BillingService] Processing payment webhook event: ${eventName}`);

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const notes = payload.payload?.payment?.entity?.notes || payload.payload?.order?.entity?.notes || {};
      const coachingId = notes.coachingId;

      if (coachingId) {
        if (notes.type === 'PLAN_UPGRADE' && notes.planCode) {
          await this.upgradePlan(
            {
              planCode: notes.planCode,
              billingCycle: (notes.billingCycle as any) || 'MONTHLY',
            },
            coachingId,
          );
        } else if (notes.type === 'AI_CREDITS' && notes.credits) {
          await this.purchaseCredits(
            {
              credits: Number(notes.credits),
            },
            coachingId,
          );
        }
      }
    }

    return { status: 'PROCESSED' };
  }
}
