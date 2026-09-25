import { z } from 'zod';

const AUDIENCES = ['ALL', 'STUDENTS', 'PARENTS', 'TEACHERS'] as const;

export const createNoticeSchema = z
  .object({
    title: z.string().trim().min(3).max(255),
    content: z.string().trim().min(5).max(5000),
    batchId: z.string().uuid().optional().nullable(),
    targetAudience: z.enum(AUDIENCES).default('ALL'),
    isPinned: z.boolean().default(false),
    expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  })
  .strict();

export const updateNoticeSchema = z
  .object({
    title: z.string().trim().min(3).max(255).optional(),
    content: z.string().trim().min(5).max(5000).optional(),
    batchId: z.string().uuid().optional().nullable(),
    targetAudience: z.enum(AUDIENCES).optional(),
    isPinned: z.boolean().optional(),
    expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  })
  .strict();

export const noticeFilterSchema = z.object({
  batchId: z.string().uuid().optional(),
  targetAudience: z.enum(AUDIENCES).optional(),
  includeExpired: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
});
