/**
 * Usage: `parseJson(req, ChatMessagesBodySchema)`
 */

import { z } from 'zod';

export const ChatMessagesBodySchema = z.object({
  chatId: z.string().min(1),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(30),
});

export type ChatMessagesBody = z.infer<typeof ChatMessagesBodySchema>;
