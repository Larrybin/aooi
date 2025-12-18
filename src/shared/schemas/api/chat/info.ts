/**
 * Usage: `parseJson(req, ChatInfoBodySchema)`
 */

import { z } from 'zod';

export const ChatInfoBodySchema = z.object({
  chatId: z.string().min(1),
});

export type ChatInfoBody = z.infer<typeof ChatInfoBodySchema>;
