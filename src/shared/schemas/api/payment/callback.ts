/**
 * Usage: `parseQuery(req.url, PaymentCallbackQuerySchema)`
 */

import { z } from 'zod';

export const PaymentCallbackQuerySchema = z.object({
  order_no: z.string().min(1),
});

export type PaymentCallbackQuery = z.infer<typeof PaymentCallbackQuerySchema>;

