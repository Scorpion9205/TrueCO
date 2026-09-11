import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    coachingCode: z.string().optional(),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(20, 'Invalid refresh token format'),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
