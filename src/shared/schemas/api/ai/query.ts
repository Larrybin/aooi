/**
 * Usage: `parseJson(req, AiQueryBodySchema)`
 */

import { z } from 'zod';

export const AiQueryBodySchema = z.object({
  taskId: z.string().min(1),
});

export type AiQueryBody = z.infer<typeof AiQueryBodySchema>;
