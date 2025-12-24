/**
 * Usage: `parseJson(req, EmailVerifyCodeBodySchema)`
 */

import { z } from 'zod';

const EmailAddressSchema = z.string().trim().email();
const VerificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'invalid verification code');

export const EmailVerifyCodeBodySchema = z.object({
  email: EmailAddressSchema,
  code: VerificationCodeSchema,
});

export type EmailVerifyCodeBody = z.infer<typeof EmailVerifyCodeBodySchema>;
