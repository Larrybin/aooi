/**
 * Usage: `parseJson(req, ChatStreamBodySchema)`
 */

import { z } from 'zod';

export const ChatStreamBodySchema = z.object({
  chatId: z.string().min(1),
  message: z.unknown(),
  model: z.string().min(1),
  webSearch: z.boolean().optional().default(false),
  reasoning: z.boolean().optional(),
});

export type ChatStreamBody = z.infer<typeof ChatStreamBodySchema>;
