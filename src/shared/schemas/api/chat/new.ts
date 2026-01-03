/**
 * Usage: `parseJson(req, ChatNewBodySchema)`
 */

import { z } from 'zod';

import { CHAT_ALLOWED_MODELS } from '@/shared/constants/chat-model-policy';

const MAX_CHAT_TEXT_CHARS = 8000;

export const ChatNewBodySchema = z.object({
  message: z.object({
    text: z.string().min(1).max(MAX_CHAT_TEXT_CHARS),
  }),
  body: z.object({
    model: z.enum(CHAT_ALLOWED_MODELS),
  }),
});

export type ChatNewBody = z.infer<typeof ChatNewBodySchema>;
