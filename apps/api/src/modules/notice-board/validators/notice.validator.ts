import { z } from 'zod';

export const createNoticeSchema = z.object({
  title: z.string().min(3).max(255),
  content: z.string().min(5),
  batchId: z.string().uuid().optional().nullable(),
  targetAudience: z.enum(['ALL', 'STUDENTS', 'PARENTS', 'TEACHERS']).default('ALL'),
  isPinned: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const updateNoticeSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  content: z.string().min(5).optional(),
  batchId: z.string().uuid().optional().nullable(),
  targetAudience: z.enum(['ALL', 'STUDENTS', 'PARENTS', 'TEACHERS']).optional(),
  isPinned: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const noticeFilterSchema = z.object({
  batchId: z.string().uuid().optional(),
  targetAudience: z.string().optional(),
  includeExpired: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
});
