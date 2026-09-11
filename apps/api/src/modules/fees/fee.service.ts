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
import { DiscountType, FeeInstallmentStatus } from '@trueco/types';

export class FeeService {
  public constructor(
    private readonly feeRepository: IFeeRepository,
    private readonly eventBus: IEventBus,
  ) {}

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
}
