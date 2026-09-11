import {
  FeeInstallmentResponseDto,
  FeePlanResponseDto,
  FeeTransactionResponseDto,
} from './dto/fee.dto.js';
import { DiscountType, FeeInstallmentStatus, PaymentMethod } from '@trueco/types';

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
    const balanceAmount = Math.max(0, amount - paidAmount);

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
    const totalPaid = installments.reduce((acc: number, i: any) => acc + i.paidAmount, 0);
    const finalAmount = Number(entity.finalAmount);
    const totalPending = Math.max(0, finalAmount - totalPaid);

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
      installments,
      createdAt: new Date(entity.createdAt),
    };
  }
}
