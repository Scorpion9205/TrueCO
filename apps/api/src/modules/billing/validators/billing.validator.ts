import { z } from 'zod';
import { PlanCode } from '@trueco/types';

export const upgradePlanSchema = z.object({
  planCode: z.nativeEnum(PlanCode),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

export const purchaseCreditsSchema = z.object({
  credits: z.number().int().positive('Credits must be greater than zero').max(50000),
});

export type UpgradePlanSchemaType = z.infer<typeof upgradePlanSchema>;
export type PurchaseCreditsSchemaType = z.infer<typeof purchaseCreditsSchema>;
