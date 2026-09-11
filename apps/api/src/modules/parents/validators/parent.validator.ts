import { z } from 'zod';

export const createParentSchema = z
  .object({
    name: z.string().min(2).max(255).trim(),
    phone: z.string().min(10).max(30).trim(),
    email: z.string().email().trim().toLowerCase().optional(),
    relation: z.string().default('FATHER'),
    studentId: z.string().uuid().optional(),
    isPrimary: z.boolean().default(true),
  })
  .strict();

export const linkStudentParentSchema = z
  .object({
    studentId: z.string().uuid(),
    parentId: z.string().uuid(),
    isPrimary: z.boolean().default(false),
  })
  .strict();

export type CreateParentInput = z.infer<typeof createParentSchema>;
export type LinkStudentParentInput = z.infer<typeof linkStudentParentSchema>;
