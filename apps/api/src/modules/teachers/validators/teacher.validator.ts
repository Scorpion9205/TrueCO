import { z } from 'zod';

export const createTeacherSchema = z
  .object({
    name: z.string().min(2).max(255).trim(),
    phone: z.string().min(10).max(30).trim(),
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(6).optional(),
    specialization: z.string().max(255).optional(),
    monthlySalary: z.number().nonnegative().optional(),
    joiningDate: z.string().date().optional(),
  })
  .strict();

export const updateTeacherSchema = z
  .object({
    name: z.string().min(2).max(255).trim().optional(),
    phone: z.string().min(10).max(30).trim().optional(),
    specialization: z.string().max(255).optional(),
    monthlySalary: z.number().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
