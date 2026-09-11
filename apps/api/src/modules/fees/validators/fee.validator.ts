import { z } from 'zod';
import { DiscountType, PaymentMethod } from '@trueco/types';

export const createFeeInstallmentSchema = z.object({
  installmentNo: z.number().int().positive(),
  amount: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

export const createFeePlanSchema = z.object({
  studentId: z.string().uuid(),
  totalAmount: z.number().positive(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().min(0).optional(),
  academicYear: z.string().min(1).max(50),
  installments: z.array(createFeeInstallmentSchema).min(1, 'At least one installment is required'),
});

export const recordFeePaymentSchema = z.object({
  installmentId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  transactionRef: z.string().max(100).optional(),
  remarks: z.string().max(255).optional(),
});

export const waiveInstallmentSchema = z.object({
  remarks: z.string().max(255).optional(),
});

export type CreateFeePlanSchemaType = z.infer<typeof createFeePlanSchema>;
export type RecordFeePaymentSchemaType = z.infer<typeof recordFeePaymentSchema>;
export type WaiveInstallmentSchemaType = z.infer<typeof waiveInstallmentSchema>;
