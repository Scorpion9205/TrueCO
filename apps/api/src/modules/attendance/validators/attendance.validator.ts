import { z } from 'zod';
import { AttendanceStatus } from '@vargly/types';

export const markAttendanceSchema = z
  .object({
    batchId: z.string().uuid(),
    sessionDate: z.string().date(),
    slot: z.string().max(50).optional(),
    remarks: z.string().optional(),
    records: z
      .array(
        z.object({
          studentId: z.string().uuid(),
          status: z.nativeEnum(AttendanceStatus),
          remarks: z.string().max(255).optional(),
        }),
      )
      .min(1, 'At least one student attendance record must be submitted'),
  })
  .strict();

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
