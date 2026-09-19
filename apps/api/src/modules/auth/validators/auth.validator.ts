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
    refreshToken: z.string().min(1, 'Refresh token is required'),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Invalid or expired password reset token'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    token: z.string().min(10, 'Invalid verification token'),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
