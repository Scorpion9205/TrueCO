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

export const updateStudentSchema = z
  .object({
    rollNumber: z.string().max(50).trim().optional(),
    firstName: z.string().min(1).max(100).trim().optional(),
    lastName: z.string().min(1).max(100).trim().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    dob: z.string().date().optional(),
    phone: z.string().max(30).trim().optional(),
    email: z.string().email().trim().toLowerCase().optional(),
    address: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
