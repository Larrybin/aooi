/**
 * Usage: `parseJson(req, EmailSendBodySchema)`
 */

import { z } from 'zod';

export const EmailSendBodySchema = z.object({
  emails: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  subject: z.string().min(1),
});

export type EmailSendBody = z.infer<typeof EmailSendBodySchema>;
