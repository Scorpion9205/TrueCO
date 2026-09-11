import { z } from 'zod';

export const teacherDashboardQuerySchema = z.object({
  teacherId: z.string().uuid().optional(),
});
