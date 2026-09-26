import { PaymentMethod } from '@vargly/types';

export interface GenerateSalaryDto {
  readonly teacherId: string;
  readonly month: number; // 1 - 12
  readonly year: number;
  readonly amount?: number;
  readonly remarks?: string;
}

export interface RecordSalaryPaymentDto {
  readonly salaryId: string;
  readonly paymentMethod: PaymentMethod;
  readonly paidAt?: string;
  readonly remarks?: string;
}

export interface SalaryResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly teacherId: string;
  readonly teacherName?: string;
  readonly amount: number;
  readonly month: number;
  readonly year: number;
  readonly status: string; // 'PENDING' | 'PAID'
  readonly paidAt?: Date | null;
  readonly paymentMethod?: PaymentMethod | null;
  readonly remarks?: string | null;
  readonly createdAt: Date;
}

export interface SalaryFilterDto {
  readonly teacherId?: string;
  readonly month?: number;
  readonly year?: number;
  readonly status?: string;
}
