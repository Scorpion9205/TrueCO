import { z } from 'zod';

export const createStudentSchema = z
  .object({
    rollNumber: z.string().max(50).trim().optional(),
    firstName: z.string().min(1).max(100).trim(),
    lastName: z.string().min(1).max(100).trim(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    dob: z.string().date().optional(),
    phone: z.string().max(30).trim().optional(),
    email: z.string().email().trim().toLowerCase().optional(),
    address: z.string().optional(),
    joiningDate: z.string().date().optional(),
  })
  .strict();

// Optional details can be cleared by sending null (omitting a field leaves it unchanged)
export const updateStudentSchema = z
  .object({
    rollNumber: z.string().max(50).trim().nullable().optional(),
    firstName: z.string().min(1).max(100).trim().optional(),
    lastName: z.string().min(1).max(100).trim().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
    dob: z.string().date().nullable().optional(),
    phone: z.string().max(30).trim().nullable().optional(),
    email: z.string().email().trim().toLowerCase().nullable().optional(),
    address: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

/** GET /students query; page/limit are optional so callers that want the whole list still get it */
export const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
