/**
 * Usage: `parseJson(req, PaymentCheckoutBodySchema)`
 */

import { z } from 'zod';

export const PaymentCheckoutBodySchema = z.object({
  product_id: z.string().min(1),
  currency: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  payment_provider: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PaymentCheckoutBody = z.infer<typeof PaymentCheckoutBodySchema>;
