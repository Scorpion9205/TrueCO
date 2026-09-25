import { z } from 'zod';

export const createTeacherSchema = z
  .object({
    name: z.string().min(2).max(255).trim(),
    phone: z.string().min(10).max(30).trim(),
    email: z.string().email().trim().toLowerCase(),
    // The teacher signs in with this; the owner shares it and the teacher can change it later
    password: z.string().min(8).max(128),
    specialization: z.string().max(255).optional(),
    monthlySalary: z.number().nonnegative().optional(),
    joiningDate: z.string().date().optional(),
  })
  .strict();

export const updateTeacherSchema = z
  .object({
    name: z.string().min(2).max(255).trim().optional(),
    phone: z.string().min(10).max(30).trim().optional(),
    // null clears
    specialization: z.string().max(255).trim().nullable().optional(),
    monthlySalary: z.number().nonnegative().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
