import { z } from 'zod';
import { rupeeAmount } from '../../../common/money/money.js';
import { PaymentMethod } from '@trueco/types';

export const generateSalarySchema = z.object({
  teacherId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  amount: rupeeAmount().optional(),
  remarks: z.string().max(255).optional(),
});

export const recordSalaryPaymentSchema = z.object({
  salaryId: z.string().uuid(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paidAt: z.string().datetime().optional(),
  remarks: z.string().max(255).optional(),
});

export const salaryFilterSchema = z.object({
  teacherId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  status: z.string().optional(),
});

export type GenerateSalarySchemaType = z.infer<typeof generateSalarySchema>;
export type RecordSalaryPaymentSchemaType = z.infer<typeof recordSalaryPaymentSchema>;
export type SalaryFilterSchemaType = z.infer<typeof salaryFilterSchema>;
