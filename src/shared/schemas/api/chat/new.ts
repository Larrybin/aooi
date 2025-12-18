/**
 * Usage: `parseJson(req, ChatNewBodySchema)`
 */

import { z } from 'zod';

export const ChatNewBodySchema = z.object({
  message: z.object({
    text: z.string().min(1),
  }),
  body: z.object({
    model: z.string().min(1),
  }),
});

export type ChatNewBody = z.infer<typeof ChatNewBodySchema>;
