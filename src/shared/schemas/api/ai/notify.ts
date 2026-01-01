/**
 * Usage: `parseParams(params, AiNotifyParamsSchema)`
 */

import { z } from 'zod';

export const AiNotifyParamsSchema = z.object({
  provider: z.string().min(1),
});

export type AiNotifyParams = z.infer<typeof AiNotifyParamsSchema>;
