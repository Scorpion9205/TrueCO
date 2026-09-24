import { RequestContextService } from '../../common/services/request-context.service.js';
import { isUuid } from '../../common/validation/is-uuid.js';
import { StatusCodes } from 'http-status-codes';
import { IFeeRepository } from './fee.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import {
  CreateFeePlanDto,
  FeeInstallmentResponseDto,
  FeePlanResponseDto,
  FeeTransactionResponseDto,
  RecordFeePaymentDto,
  WaiveInstallmentDto,
} from './dto/fee.dto.js';
import { FeeMapper } from './fee.mapper.js';
import {
  createFeePaidEvent,
  createFeePlanCreatedEvent,
  createFeeWaivedEvent,
} from './fee.events.js';
import { DiscountType, FeeInstallmentStatus, PaymentMethod } from '@trueco/types';
import { IPaymentGatewayAdapter, PaymentLinkResult } from '../billing/adapters/payment-gateway.interface.js';
import { MockPaymentGatewayAdapter } from '../billing/adapters/mock-payment-gateway.adapter.js';
import { RazorpayAdapter } from '../billing/adapters/razorpay.adapter.js';
import { envConfig } from '../../config/env.config.js';
import { logger } from '../../common/logger/logger.service.js';
import { paymentReconcileTotal } from '../../common/metrics/metrics.service.js';
import { fromPaise, money, toRupees } from '../../common/money/money.js';

export class FeeService {
  private readonly paymentAdapter: IPaymentGatewayAdapter;

  public constructor(
    private readonly feeRepository: IFeeRepository,
    private readonly eventBus: IEventBus,
    paymentAdapter?: IPaymentGatewayAdapter,
  ) {
    this.paymentAdapter =
      paymentAdapter ||
      (envConfig.get('RAZORPAY_KEY_ID') ? new RazorpayAdapter() : new MockPaymentGatewayAdapter());
  }

  public async createFeePlan(
    dto: CreateFeePlanDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<FeePlanResponseDto> {
    // 1. Calculate discount and final amount in exact decimals, rounded to the paisa
    const total = money(dto.totalAmount);
    let final = total;
    if (dto.discountType && dto.discountValue && dto.discountValue > 0) {
      const discount =
        dto.discountType === DiscountType.PERCENTAGE
          ? total.times(dto.discountValue).dividedBy(100)
          : money(dto.discountValue);
      final = total.minus(discount);
      if (final.isNegative()) final = money(0);
    }
    final = final.toDecimalPlaces(2);
    const finalAmount = final.toNumber();

    // 2. Installments must add up to the final amount exactly (to the paisa)
    const installmentTotal = dto.installments.reduce((acc, inst) => acc.plus(inst.amount), money(0));
    if (!installmentTotal.equals(final)) {
      throw new AppError(
        'INVALID_INSTALLMENT_SUM',
        `Sum of installments (${installmentTotal.toFixed(2)}) must equal final amount (${final.toFixed(2)})`,
        StatusCodes.BAD_REQUEST,
      );
    }

    // 3. Persist via repository
    const plan = await this.feeRepository.createFeePlan({
      coachingId,
      studentId: dto.studentId,
      totalAmount: dto.totalAmount,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      finalAmount,
      academicYear: dto.academicYear,
      createdBy: userId,
      installments: dto.installments.map((inst) => ({
        installmentNo: inst.installmentNo,
        amount: inst.amount,
        dueDate: new Date(inst.dueDate),
      })),
    });

    const responseDto = FeeMapper.toPlanDto(plan);

    await this.eventBus.publish(
      createFeePlanCreatedEvent(
        {
          feePlanId: responseDto.id,
          coachingId,
          studentId: responseDto.studentId,
          finalAmount: responseDto.finalAmount,
          installmentsCount: dto.installments.length,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async recordPayment(
    dto: RecordFeePaymentDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<FeeTransactionResponseDto & { duplicate?: boolean }> {
    // Balance, status and duplicate checks run inside the repository's locked transaction;
    // checking here first would race with concurrent payments.
    const result = await this.feeRepository.recordPaymentTransaction({
      coachingId,
      installmentId: dto.installmentId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      transactionRef: dto.transactionRef,
      remarks: dto.remarks,
      createdBy: userId,
    });

    if (result.kind === 'duplicate') {
      logger.info(`[FeeService] Payment ${dto.transactionRef} already recorded; ignoring repeat`);
      return { ...FeeMapper.toTransactionDto(result.transaction), duplicate: true };
    }

    const { transaction, installment: updatedInstallment, plan, remainingBalance } = result;
    await this.eventBus.publish(
      createFeePaidEvent(
        {
          transactionId: transaction.id,
          coachingId,
          studentId: plan.studentId,
          installmentId: dto.installmentId,
          amount: toRupees(transaction.amount),
          paymentMethod: dto.paymentMethod,
          receiptNumber: transaction.receiptNumber,
          remainingBalance: toRupees(remainingBalance),
          isFullyPaid: updatedInstallment.status === FeeInstallmentStatus.PAID,
        },
        correlationId,
        userId,
      ),
    );

    return FeeMapper.toTransactionDto(transaction);
  }

  public async waiveInstallment(
    installmentId: string,
    dto: WaiveInstallmentDto,
    coachingId: string,
    userId?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<FeeInstallmentResponseDto> {
    const installment = await this.feeRepository.findInstallmentById(installmentId);
    if (!installment || installment.coachingId !== coachingId) {
      throw new AppError('INSTALLMENT_NOT_FOUND', 'Fee installment not found', StatusCodes.NOT_FOUND);
    }

    if (installment.status === FeeInstallmentStatus.PAID) {
      throw new AppError('CANNOT_WAIVE_PAID', 'Cannot waive an already paid installment', StatusCodes.BAD_REQUEST);
    }

    const waived = await this.feeRepository.waiveInstallment(installmentId, dto.remarks);
    if (!waived) {
      throw new AppError(
        'INSTALLMENT_NOT_WAIVABLE',
        'The installment was paid or waived in the meantime',
        StatusCodes.CONFLICT,
      );
    }
    const responseDto = FeeMapper.toInstallmentDto(waived);

    await this.eventBus.publish(
      createFeeWaivedEvent(
        {
          installmentId,
          coachingId,
          studentId: waived.feePlan.studentId,
          waivedAmount: responseDto.balanceAmount,
        },
        correlationId,
        userId,
      ),
    );

    return responseDto;
  }

  public async getStudentFeePlans(studentId: string): Promise<FeePlanResponseDto[]> {
    const plans = await this.feeRepository.findPlansByStudent(studentId);
    return plans.map(FeeMapper.toPlanDto);
  }

  public async getPlanById(id: string): Promise<FeePlanResponseDto> {
    const plan = await this.feeRepository.findPlanById(id);
    if (!plan) {
      throw new AppError('PLAN_NOT_FOUND', 'Fee plan not found', StatusCodes.NOT_FOUND);
    }
    return FeeMapper.toPlanDto(plan);
  }

  public async getDefaulters(coachingId: string): Promise<any[]> {
    const installments = await this.feeRepository.findPendingInstallments(new Date());
    const filtered = installments.filter((i: any) => i.coachingId === coachingId);
    return filtered.map((inst: any) => {
      const balance = toRupees(money(inst.amount).minus(money(inst.paidAmount)));
      return {
        installmentId: inst.id,
        installmentNo: inst.installmentNo,
        amount: Number(inst.amount),
        paidAmount: Number(inst.paidAmount || 0),
        pendingAmount: balance,
        dueDate: inst.dueDate,
        status: inst.status,
        student: inst.feePlan?.student
          ? {
              id: inst.feePlan.student.id,
              name: `${inst.feePlan.student.firstName} ${inst.feePlan.student.lastName}`,
              phone: inst.feePlan.student.phone,
              email: inst.feePlan.student.email,
            }
          : undefined,
      };
    });
  }

  public async createPaymentLink(
    installmentId: string,
    coachingId: string,
  ): Promise<PaymentLinkResult> {
    const installment = await this.feeRepository.findInstallmentById(installmentId);
    if (!installment || installment.coachingId !== coachingId) {
      throw new AppError('INSTALLMENT_NOT_FOUND', 'Fee installment not found', StatusCodes.NOT_FOUND);
    }

    if (installment.status === FeeInstallmentStatus.PAID) {
      throw new AppError('ALREADY_PAID', 'Installment is already paid', StatusCodes.BAD_REQUEST);
    }
    if (installment.status === FeeInstallmentStatus.WAIVED) {
      throw new AppError('WAIVED', 'Installment is waived', StatusCodes.BAD_REQUEST);
    }

    const balance = toRupees(money(installment.amount).minus(money(installment.paidAmount)));

    return this.paymentAdapter.createPaymentLink({
      amount: balance,
      currency: 'INR',
      description: `Coaching Fee Installment #${installment.installmentNo}`,
      customer: {
        name: `Student Installment ${installment.installmentNo}`,
      },
      referenceId: installment.id,
      notes: {
        coachingId,
        installmentId: installment.id,
      },
    });
  }

  public async handlePaymentWebhook(
    payload: any,
    signature: string,
    rawBody?: Buffer | string,
  ): Promise<{ status: string }> {
    const isValid = this.paymentAdapter.verifyWebhookSignature(
      rawBody || JSON.stringify(payload),
      signature,
    );

    if (!isValid) {
      throw new AppError(
        'INVALID_SIGNATURE',
        'Payment webhook signature verification failed',
        StatusCodes.UNAUTHORIZED,
      );
    }

    const eventName = payload.event;
    logger.info(`[FeeService] Processing fee payment webhook event: ${eventName}`);

    if (eventName !== 'payment.captured' && eventName !== 'payment_link.paid') {
      return { status: 'IGNORED' };
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const notes = paymentEntity?.notes || payload.payload?.payment_link?.entity?.notes || {};
    const installmentId = notes.installmentId || paymentEntity?.description?.split('#')?.[1];
    const coachingId = notes.coachingId;
    if (!paymentEntity?.id || !isUuid(installmentId) || !isUuid(coachingId) || !paymentEntity.amount) {
      logger.error('[FeeService] Payment webhook missing payment, installment or coaching reference', {
        event: eventName,
        paymentId: paymentEntity?.id,
      });
      return { status: 'IGNORED' };
    }
    if (paymentEntity.currency && paymentEntity.currency !== 'INR') {
      paymentReconcileTotal.inc({ source: 'fee', reason: 'UNSUPPORTED_CURRENCY' });
      logger.error(`[FeeService] RECONCILE: unsupported currency ${paymentEntity.currency} for payment ${paymentEntity.id}`);
      return { status: 'REJECTED' };
    }

    try {
      // Webhooks carry no session: act as the coaching named in the signed payment notes.
      // payment.captured and payment_link.paid both arrive for one payment; the gateway
      // payment id makes the second (and any retry) a no-op.
      const result = await RequestContextService.runForTenant(coachingId, () =>
        this.recordPayment(
          {
            installmentId,
            amount: fromPaise(paymentEntity.amount).toNumber(),
            paymentMethod: PaymentMethod.ONLINE,
            transactionRef: paymentEntity.id,
            remarks: `Online payment via Razorpay (${paymentEntity.id})`,
          },
          coachingId,
        ),
      );
      return { status: result.duplicate ? 'DUPLICATE' : 'PROCESSED' };
    } catch (err) {
      if (err instanceof AppError && err.statusCode < 500) {
        // Money was taken but cannot be applied (e.g. installment already paid or waived).
        // Retrying will not help; this needs a person to reconcile or refund.
        paymentReconcileTotal.inc({ source: 'fee', reason: err.code });
        logger.error('[FeeService] RECONCILE: online payment could not be applied to its installment', err, {
          paymentId: paymentEntity.id,
          installmentId,
          coachingId,
          reason: err.code,
        });
        return { status: 'REJECTED' };
      }
      // Transient failure: surface it so the gateway retries the webhook
      throw err;
    }
  }
}
