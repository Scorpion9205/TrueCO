import { z } from 'zod';

export const studentImportRowSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format'),
  email: z.string().email().optional().or(z.literal('')),
  rollNo: z.string().max(50).optional(),
  gender: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  parentName: z.string().min(1).max(200).optional(),
  parentPhone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid parent phone').optional().or(z.literal('')),
  parentRelation: z.string().max(50).optional(),
  batchName: z.string().max(100).optional(),
});

export const teacherImportRowSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format'),
  email: z.string().email().optional().or(z.literal('')),
  subject: z.string().min(1).max(100).optional(),
  monthlySalary: z.preprocess((val) => (val !== undefined && val !== '' ? Number(val) : undefined), z.number().min(0).optional()),
});

export const batchImportRowSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().max(100).optional(),
  academicYear: z.string().min(1).max(50),
  startTime: z.string().max(20).optional(),
  endTime: z.string().max(20).optional(),
  daysOfWeek: z.string().optional(), // Comma-separated like "MON,WED,FRI"
});

export const bulkImportSchema = z.object({
  entityType: z.enum(['STUDENTS', 'TEACHERS', 'BATCHES']),
  rows: z.array(z.record(z.unknown())).min(1),
  dryRun: z.boolean().default(false),
});
