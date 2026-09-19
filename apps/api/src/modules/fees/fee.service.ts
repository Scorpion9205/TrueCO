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
    // 1. Calculate discount and final amount
    let finalAmount = dto.totalAmount;
    if (dto.discountType && dto.discountValue && dto.discountValue > 0) {
      if (dto.discountType === DiscountType.PERCENTAGE) {
        const discountAmt = (dto.totalAmount * dto.discountValue) / 100;
        finalAmount = Math.max(0, dto.totalAmount - discountAmt);
      } else if (dto.discountType === DiscountType.FIXED) {
        finalAmount = Math.max(0, dto.totalAmount - dto.discountValue);
      }
    }

    // 2. Validate installment sum matches finalAmount (allowing a 0.05 rounding epsilon)
    const installmentTotal = dto.installments.reduce((acc, inst) => acc + inst.amount, 0);
    if (Math.abs(installmentTotal - finalAmount) > 0.1) {
      throw new AppError(
        'INVALID_INSTALLMENT_SUM',
        `Sum of installments (${installmentTotal}) must equal final amount (${finalAmount})`,
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
  ): Promise<FeeTransactionResponseDto> {
    const installment = await this.feeRepository.findInstallmentById(dto.installmentId);
    if (!installment || installment.coachingId !== coachingId) {
      throw new AppError('INSTALLMENT_NOT_FOUND', 'Fee installment not found', StatusCodes.NOT_FOUND);
    }

    if (installment.status === FeeInstallmentStatus.PAID) {
      throw new AppError(
        'INSTALLMENT_ALREADY_PAID',
        'This installment is already fully paid',
        StatusCodes.BAD_REQUEST,
      );
    }

    if (installment.status === FeeInstallmentStatus.WAIVED) {
      throw new AppError(
        'INSTALLMENT_WAIVED',
        'Cannot accept payment for a waived installment',
        StatusCodes.BAD_REQUEST,
      );
    }

    const currentPaid = Number(installment.paidAmount || 0);
    const totalAmount = Number(installment.amount);
    const remainingBalance = totalAmount - currentPaid;

    if (dto.amount > remainingBalance + 0.01) {
      throw new AppError(
        'AMOUNT_EXCEEDS_BALANCE',
        `Payment amount (${dto.amount}) exceeds remaining balance (${remainingBalance})`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const receiptNumber = await this.feeRepository.generateReceiptNumber(coachingId);

    const { transaction, installment: updatedInstallment, plan } =
      await this.feeRepository.recordPaymentTransaction({
        coachingId,
        installmentId: dto.installmentId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        transactionRef: dto.transactionRef,
        receiptNumber,
        remarks: dto.remarks,
        createdBy: userId,
      });

    const isFullyPaid = updatedInstallment.status === FeeInstallmentStatus.PAID;
    const newRemaining = Math.max(0, remainingBalance - dto.amount);

    await this.eventBus.publish(
      createFeePaidEvent(
        {
          transactionId: transaction.id,
          coachingId,
          studentId: plan.studentId,
          installmentId: dto.installmentId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          receiptNumber,
          remainingBalance: newRemaining,
          isFullyPaid,
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
      const balance = Number(inst.amount) - Number(inst.paidAmount || 0);
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

    const currentPaid = Number(installment.paidAmount || 0);
    const totalAmount = Number(installment.amount);
    const balance = totalAmount - currentPaid;

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

    if (eventName === 'payment.captured' || eventName === 'payment_link.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const notes = paymentEntity?.notes || payload.payload?.payment_link?.entity?.notes || {};
      const installmentId = notes.installmentId || paymentEntity?.description?.split('#')?.[1];
      const coachingId = notes.coachingId;
      const amount = paymentEntity?.amount ? paymentEntity.amount / 100 : undefined;

      if (installmentId && coachingId && amount) {
        try {
          await this.recordPayment(
            {
              installmentId,
              amount,
              paymentMethod: PaymentMethod.ONLINE,
              transactionRef: paymentEntity.id,
              remarks: `Online payment via Razorpay (${paymentEntity.id})`,
            },
            coachingId,
          );
        } catch (err) {
          logger.error(`[FeeService] Error auto-recording fee payment from webhook:`, err);
        }
      }
    }

    return { status: 'PROCESSED' };
  }
}
