/**
 * Usage: `parseJson(req, EmailSendBodySchema)`
 */

import { z } from 'zod';

const EmailAddressSchema = z.string().trim().email();

export const EmailSendBodySchema = z.object({
  emails: z.union([EmailAddressSchema, z.array(EmailAddressSchema).min(1)]),
  subject: z.string().trim().min(1).max(200),
});

export type EmailSendBody = z.infer<typeof EmailSendBodySchema>;
