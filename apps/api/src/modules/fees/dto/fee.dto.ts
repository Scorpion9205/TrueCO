import { DiscountType, FeeInstallmentStatus, PaymentMethod } from '@vargly/types';

export interface CreateFeeInstallmentInputDto {
  readonly installmentNo: number;
  readonly amount: number;
  readonly dueDate: string; // YYYY-MM-DD
}

export interface CreateFeePlanDto {
  readonly studentId: string;
  readonly totalAmount: number;
  readonly discountType?: DiscountType;
  readonly discountValue?: number;
  readonly academicYear: string;
  readonly installments: CreateFeeInstallmentInputDto[];
}

export interface RecordFeePaymentDto {
  readonly installmentId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly transactionRef?: string;
  readonly remarks?: string;
}

export interface WaiveInstallmentDto {
  readonly remarks?: string;
}

export interface FeeTransactionResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly installmentId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly transactionRef?: string | null;
  readonly receiptNumber: string;
  readonly paidAt: Date;
  readonly remarks?: string | null;
}

export interface FeeInstallmentResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly feePlanId: string;
  readonly installmentNo: number;
  readonly amount: number;
  readonly paidAmount: number;
  readonly balanceAmount: number;
  readonly dueDate: Date;
  readonly status: FeeInstallmentStatus;
  readonly transactions?: FeeTransactionResponseDto[];
}

export interface FeePlanResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly studentId: string;
  readonly studentName?: string;
  readonly totalAmount: number;
  readonly discountType?: DiscountType | null;
  readonly discountValue?: number | null;
  readonly finalAmount: number;
  readonly academicYear: string;
  readonly totalPaid: number;
  /** Still to be collected: the fee minus payments and waived amounts */
  readonly totalPending: number;
  /** Forgiven through waivers */
  readonly totalWaived: number;
  readonly installments?: FeeInstallmentResponseDto[];
  readonly createdAt: Date;
}
