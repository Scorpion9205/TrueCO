import { z } from 'zod';

export const registerCoachingSchema = z
  .object({
    coachingName: z.string().min(2).max(255).trim(),
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

/** The institute's own details; the code is fixed because teachers sign in with it. null clears. */
export const updateCoachingSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    phone: z.string().trim().min(10).max(15).optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    address: z.string().trim().max(500).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

export type UpdateCoachingInput = z.infer<typeof updateCoachingSchema>;
export type RegisterCoachingInput = z.infer<typeof registerCoachingSchema>;
