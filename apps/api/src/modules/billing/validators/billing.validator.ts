import { z } from 'zod';
import { PlanCode } from '@trueco/types';

// The client says what it wants to buy; the price is always computed on the server.
export const createBillingOrderSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('PLAN_UPGRADE'),
      planCode: z.nativeEnum(PlanCode),
      billingCycle: z.enum(['MONTHLY', 'YEARLY']),
    })
    .strict(),
  z
    .object({
      type: z.literal('AI_CREDITS'),
      credits: z.number().int().positive('Credits must be greater than zero').max(50000),
    })
    .strict(),
]);

export type CreateBillingOrderSchemaType = z.infer<typeof createBillingOrderSchema>;
