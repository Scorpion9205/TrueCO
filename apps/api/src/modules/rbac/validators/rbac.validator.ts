import { z } from 'zod';

export const assignRoleSchema = z
  .object({
    roleCode: z.string().min(2, 'Role code must be specified').trim(),
  })
  .strict();

export const createRoleSchema = z
  .object({
    code: z.string().min(2).max(50).trim().toUpperCase(),
    name: z.string().min(2).max(100).trim(),
    description: z.string().optional(),
    permissionCodes: z.array(z.string()).default([]),
  })
  .strict();

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
