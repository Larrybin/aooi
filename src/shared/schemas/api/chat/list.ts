import { z } from 'zod';

export const ChatListBodySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(30),
});

export type ChatListBody = z.infer<typeof ChatListBodySchema>;
