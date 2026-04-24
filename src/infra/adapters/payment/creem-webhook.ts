import {
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
} from '@/domains/billing/domain/payment';
import { z } from 'zod';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { tryJsonParse } from '@/shared/lib/json';
import { signHmacSha256Hex } from '@/shared/lib/runtime/crypto';

const creemSignaturePattern = /^[0-9a-f]{64}$/;

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
};

const creemWebhookEventSchema = z
  .object({
    eventType: z.string().min(1),
    object: z.record(z.string(), z.unknown()),
  })
  .passthrough();

type CreemSubtleCrypto = Pick<SubtleCrypto, 'importKey' | 'sign'>;

export type ParsedCreemWebhookEvent = z.infer<typeof creemWebhookEventSchema>;

export function normalizeCreemWebhookSignature(
  signatureHeader: string | null
): string {
  const signature = signatureHeader?.trim().toLowerCase() || '';
  if (!signature || !creemSignaturePattern.test(signature)) {
    throw new WebhookVerificationError('invalid webhook signature');
  }
  return signature;
}

export async function generateCreemWebhookSignature(
  payload: string,
  secret: string,
  subtleCrypto: CreemSubtleCrypto = crypto.subtle
): Promise<string> {
  try {
    return await signHmacSha256Hex(payload, secret, subtleCrypto);
  } catch (_error) {
    throw new ServiceUnavailableError('failed to generate signature');
  }
}

export async function verifyAndParseCreemWebhookEvent({
  rawBody,
  signatureHeader,
  signingSecret,
  subtleCrypto = crypto.subtle,
}: {
  rawBody: string;
  signatureHeader: string | null;
  signingSecret?: string;
  subtleCrypto?: CreemSubtleCrypto;
}): Promise<ParsedCreemWebhookEvent> {
  if (!rawBody || !signatureHeader) {
    throw new WebhookVerificationError('invalid webhook request');
  }

  const signature = normalizeCreemWebhookSignature(signatureHeader);

  if (!signingSecret) {
    throw new WebhookConfigError('signing secret not configured');
  }

  const computedSignature = await generateCreemWebhookSignature(
    rawBody,
    signingSecret,
    subtleCrypto
  );

  if (!constantTimeEqual(computedSignature, signature)) {
    throw new WebhookVerificationError('invalid webhook signature');
  }

  const parsedEvent = tryJsonParse(rawBody);
  if (!parsedEvent.ok) {
    throw new WebhookPayloadError('invalid webhook payload');
  }

  const parsedWebhookEvent = creemWebhookEventSchema.safeParse(
    parsedEvent.value
  );
  if (!parsedWebhookEvent.success) {
    throw new WebhookPayloadError('invalid webhook payload');
  }

  return parsedWebhookEvent.data;
}
