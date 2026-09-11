import { z } from 'zod';
import { RiskLevel } from '@trueco/types';

export const riskFilterSchema = z.object({
  level: z.nativeEnum(RiskLevel).optional(),
  minScore: z.preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number().min(0).max(100).optional()),
  maxScore: z.preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number().min(0).max(100).optional()),
});
