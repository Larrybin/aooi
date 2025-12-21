/**
 * Usage: `parseParams(params, PaymentNotifyParamsSchema)`
 */

import { z } from 'zod';

export const PaymentNotifyParamsSchema = z.object({
  provider: z.string().min(1),
});

export type PaymentNotifyParams = z.infer<typeof PaymentNotifyParamsSchema>;
