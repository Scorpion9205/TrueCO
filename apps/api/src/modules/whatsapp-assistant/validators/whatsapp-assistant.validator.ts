import { z } from 'zod';

export const inboundWhatsAppMessageSchema = z.object({
  messageId: z.string().min(1),
  from: z.string().min(8).max(30),
  body: z.string().min(1),
  timestamp: z.number().optional(),
});
