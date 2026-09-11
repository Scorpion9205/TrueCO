import { z } from 'zod';

export const createBatchSchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    subject: z.string().max(100).trim().optional(),
    academicYear: z.string().min(4).max(50).trim(),
    startTime: z.string().max(20).optional(),
    endTime: z.string().max(20).optional(),
    daysOfWeek: z.array(z.string()).default([]),
    teacherIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export const enrollStudentInBatchSchema = z
  .object({
    studentId: z.string().uuid(),
  })
  .strict();

export const assignTeacherToBatchSchema = z
  .object({
    teacherId: z.string().uuid(),
    isPrimary: z.boolean().default(true),
  })
  .strict();

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type EnrollStudentInBatchInput = z.infer<typeof enrollStudentInBatchSchema>;
export type AssignTeacherToBatchInput = z.infer<typeof assignTeacherToBatchSchema>;
