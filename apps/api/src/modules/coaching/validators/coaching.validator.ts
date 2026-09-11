import { z } from 'zod';

export const registerCoachingSchema = z
  .object({
    coachingName: z.string().min(2).max(255).trim(),
    coachingCode: z
      .string()
      .min(3)
      .max(50)
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_-]+$/, 'Coaching code must contain only letters, numbers, hyphens, or underscores'),
    phone: z.string().min(10).max(15).trim(),
    email: z.string().email().trim().toLowerCase(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    ownerName: z.string().min(2).max(255).trim(),
    ownerEmail: z.string().email().trim().toLowerCase(),
    ownerPhone: z.string().min(10).max(15).trim(),
    ownerPassword: z.string().min(8, 'Owner password must be at least 8 characters long'),
    timezone: z.string().default('Asia/Kolkata'),
    currency: z.string().default('INR'),
  })
  .strict();

export type RegisterCoachingInput = z.infer<typeof registerCoachingSchema>;
