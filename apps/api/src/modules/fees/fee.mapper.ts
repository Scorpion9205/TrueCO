import {
  FeeInstallmentResponseDto,
  FeePlanResponseDto,
  FeeTransactionResponseDto,
} from './dto/fee.dto.js';
import { DiscountType, FeeInstallmentStatus, PaymentMethod } from '@trueco/types';
import { money, toRupees } from '../../common/money/money.js';

export class FeeMapper {
  public static toTransactionDto(entity: any): FeeTransactionResponseDto {
    return {
      id: entity.id,
      coachingId: entity.coachingId,
      installmentId: entity.installmentId,
      amount: Number(entity.amount),
      paymentMethod: entity.paymentMethod as PaymentMethod,
      transactionRef: entity.transactionRef,
      receiptNumber: entity.receiptNumber,
      paidAt: new Date(entity.paidAt),
      remarks: entity.remarks,
    };
  }

  public static toInstallmentDto(entity: any): FeeInstallmentResponseDto {
    const amount = Number(entity.amount);
    const paidAmount = Number(entity.paidAmount || 0);
    // A waived instalment owes nothing more, whatever was left unpaid on it
    const waived = entity.status === FeeInstallmentStatus.WAIVED;
    const balanceAmount = waived
      ? 0
      : Math.max(0, toRupees(money(entity.amount).minus(money(entity.paidAmount))));

    return {
      id: entity.id,
      coachingId: entity.coachingId,
      feePlanId: entity.feePlanId,
      installmentNo: entity.installmentNo,
      amount,
      paidAmount,
      balanceAmount,
      dueDate: new Date(entity.dueDate),
      status: entity.status as FeeInstallmentStatus,
      transactions: entity.transactions?.map(FeeMapper.toTransactionDto),
    };
  }

  public static toPlanDto(entity: any): FeePlanResponseDto {
    const installments = entity.installments?.map(FeeMapper.toInstallmentDto) || [];
    const rawInstallments: any[] = entity.installments ?? [];
    const finalAmount = Number(entity.finalAmount);
    // Summed as exact decimals: adding JavaScript numbers drifts by fractions of a paisa
    const totalPaid = toRupees(
      rawInstallments.reduce((acc, i) => acc.plus(money(i.paidAmount)), money(0)),
    );
    // What is still collectable: waived remainders are forgiven, not pending
    const totalWaived = toRupees(
      rawInstallments
        .filter((i) => i.status === FeeInstallmentStatus.WAIVED)
        .reduce((acc, i) => acc.plus(money(i.amount).minus(money(i.paidAmount))), money(0)),
    );
    const totalPending = Math.max(
      0,
      toRupees(money(entity.finalAmount).minus(totalPaid).minus(totalWaived)),
    );

    const studentName = entity.student
      ? `${entity.student.firstName} ${entity.student.lastName}`
      : undefined;

    return {
      id: entity.id,
      coachingId: entity.coachingId,
      studentId: entity.studentId,
      studentName,
      totalAmount: Number(entity.totalAmount),
      discountType: entity.discountType as DiscountType | null,
      discountValue: entity.discountValue ? Number(entity.discountValue) : null,
      finalAmount,
      academicYear: entity.academicYear,
      totalPaid,
      totalPending,
      totalWaived,
      installments,
      createdAt: new Date(entity.createdAt),
    };
  }
}
