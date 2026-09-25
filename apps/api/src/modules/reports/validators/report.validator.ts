import { z } from 'zod';

// A day (YYYY-MM-DD, read as that day in India) or an exact ISO time
const reportDate = z.union([z.string().date(), z.string().datetime({ offset: true })]);

export const reportFilterSchema = z
  .object({
    startDate: reportDate.optional(),
    endDate: reportDate.optional(),
    batchId: z.string().uuid().optional(),
    format: z.enum(['json', 'csv']).default('json'),
    threshold: z.preprocess(
      (val) => (val !== undefined ? Number(val) : undefined),
      z.number().min(0).max(100).optional(),
    ),
  })
  .refine(
    (filter) =>
      !filter.startDate ||
      !filter.endDate ||
      Date.parse(filter.startDate.length === 10 ? `${filter.startDate}T00:00:00Z` : filter.startDate) <=
        Date.parse(filter.endDate.length === 10 ? `${filter.endDate}T23:59:59Z` : filter.endDate),
    { message: 'startDate must not be after endDate', path: ['endDate'] },
  );
