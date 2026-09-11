import { z } from 'zod';

export const reportFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  batchId: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).default('json'),
  threshold: z.preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number().min(0).max(100).optional()),
});
