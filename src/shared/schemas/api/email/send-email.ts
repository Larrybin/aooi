/**
 * Usage: `parseJson(req, EmailSendBodySchema)`
 */

import { z } from 'zod';

const EmailAddressSchema = z.string().trim().email();

export const EmailSendBodySchema = z.object({
  emails: z.union([EmailAddressSchema, z.array(EmailAddressSchema).min(1)]),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !/[\r\n]/.test(value), {
      message: 'subject must not contain CR or LF characters',
    }),
});

export type EmailSendBody = z.infer<typeof EmailSendBodySchema>;
