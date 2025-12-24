/**
 * Usage: `parseJson(req, ChatNewBodySchema)`
 */

import { z } from 'zod';

const MAX_CHAT_TEXT_CHARS = 8000;

export const ChatNewBodySchema = z.object({
  message: z.object({
    text: z.string().min(1).max(MAX_CHAT_TEXT_CHARS),
  }),
  body: z.object({
    model: z.string().min(1),
  }),
});

export type ChatNewBody = z.infer<typeof ChatNewBodySchema>;
