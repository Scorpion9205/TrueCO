import { PaymentMethod } from '@trueco/types';

export interface CreateExpenseDto {
  readonly title: string;
  readonly category: string; // e.g. RENT, UTILITIES, STATIONERY, MARKETING, SALARY, OTHER
  readonly amount: number;
  readonly expenseDate: string; // YYYY-MM-DD
  readonly paymentMethod: PaymentMethod;
  readonly receiptUrl?: string;
  readonly remarks?: string;
}

export interface UpdateExpenseDto {
  readonly title?: string;
  readonly category?: string;
  readonly amount?: number;
  readonly expenseDate?: string;
  readonly paymentMethod?: PaymentMethod;
  readonly receiptUrl?: string;
  readonly remarks?: string;
}

export interface ExpenseResponseDto {
  readonly id: string;
  readonly coachingId: string;
  readonly title: string;
  readonly category: string;
  readonly amount: number;
  readonly expenseDate: Date;
  readonly paymentMethod: PaymentMethod;
  readonly receiptUrl?: string | null;
  readonly remarks?: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ExpenseFilterDto {
  readonly category?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly limit?: number;
  readonly offset?: number;
}
