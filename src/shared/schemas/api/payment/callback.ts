/**
 * Usage:
 * - `parseQuery(req.url, PaymentCallbackQuerySchema)`
 * - `parseJson(req, PaymentCallbackBodySchema)`
 */

import { z } from 'zod';

export const PaymentCallbackQuerySchema = z.object({
  order_no: z.string().min(1),
});

export type PaymentCallbackQuery = z.infer<typeof PaymentCallbackQuerySchema>;

export const PaymentCallbackBodySchema = z.object({
  order_no: z.string().min(1),
});

export type PaymentCallbackBody = z.infer<typeof PaymentCallbackBodySchema>;
