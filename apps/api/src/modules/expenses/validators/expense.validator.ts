import { z } from 'zod';
import { PaymentMethod } from '@trueco/types';

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  category: z.string().min(1, 'Category is required').max(100),
  amount: z.number().positive('Amount must be greater than zero'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  receiptUrl: z.string().url().optional().or(z.literal('')),
  remarks: z.string().max(255).optional(),
});

export const updateExpenseSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  amount: z.number().positive().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  receiptUrl: z.string().url().optional().or(z.literal('')),
  remarks: z.string().max(255).optional(),
});

export const expenseFilterSchema = z.object({
  category: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type CreateExpenseSchemaType = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseSchemaType = z.infer<typeof updateExpenseSchema>;
export type ExpenseFilterSchemaType = z.infer<typeof expenseFilterSchema>;
