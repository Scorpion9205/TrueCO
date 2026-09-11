import { z } from 'zod';

export const createTestSchema = z.object({
  batchId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(255),
  subject: z.string().min(1, 'Subject is required').max(100),
  testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  totalMarks: z.number().positive('Total marks must be greater than zero').max(1000),
  passingMarks: z.number().positive().max(1000).optional(),
});

export const studentMarkEntrySchema = z.object({
  studentId: z.string().uuid(),
  marksObtained: z.number().min(0, 'Marks obtained cannot be negative').max(1000),
  isAbsent: z.boolean().optional().default(false),
  remarks: z.string().max(255).optional(),
});

export const uploadMarksSchema = z.object({
  results: z.array(studentMarkEntrySchema).min(1, 'At least one student mark entry is required'),
});

export type CreateTestSchemaType = z.infer<typeof createTestSchema>;
export type UploadMarksSchemaType = z.infer<typeof uploadMarksSchema>;
