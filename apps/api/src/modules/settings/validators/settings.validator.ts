import { z } from 'zod';

export const brandingConfigSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
  headerText: z.string().max(255).optional(),
});

export const notificationSettingsSchema = z.object({
  whatsappEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  defaultSenderName: z.string().max(100).optional(),
});

export const updateSettingsSchema = z.object({
  branding: brandingConfigSchema.optional(),
  timezone: z.string().max(50).optional(),
  currency: z.string().max(10).optional(),
  academicYear: z.string().max(50).optional(),
  notifications: notificationSettingsSchema.optional(),
  receiptPrefix: z.string().max(20).optional(),
  attendanceThreshold: z.number().min(0).max(100).optional(),
  extraConfig: z.record(z.unknown()).optional(),
});
