import { z } from 'zod';
import { AiProviderType } from '@vargly/types';

export const generateAiCompletionSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(10000),
  systemPrompt: z.string().max(5000).optional(),
  feature: z.string().max(100).optional(),
  provider: z.nativeEnum(AiProviderType).optional(),
  model: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
});

export const generateStudentNarrativeSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  customNotes: z.string().max(2000).optional(),
  provider: z.nativeEnum(AiProviderType).optional(),
});

export const generateParentReportCardSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  includeTestHistory: z.boolean().optional(),
  includeRemarks: z.boolean().optional(),
  provider: z.nativeEnum(AiProviderType).optional(),
});

export const generateTeacherInsightSchema = z.object({
  teacherId: z.string().uuid('Invalid teacher ID format'),
  periodDays: z.number().int().min(7).max(365).optional(),
  provider: z.nativeEnum(AiProviderType).optional(),
});

export const aiPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
