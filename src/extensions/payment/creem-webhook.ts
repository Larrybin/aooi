import { z } from 'zod';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { tryJsonParse } from '@/shared/lib/json';

import {
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
} from '.';

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
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const key = await subtleCrypto.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await subtleCrypto.sign('HMAC', key, messageData);

    const signatureArray = new Uint8Array(signature);
    return Array.from(signatureArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (_error: unknown) {
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

  const parsedEvent = tryJsonParse<unknown>(rawBody);
  if (!parsedEvent.ok) {
    throw new WebhookPayloadError('invalid webhook payload');
  }

  const parsedWebhookEvent = creemWebhookEventSchema.safeParse(parsedEvent.value);
  if (!parsedWebhookEvent.success) {
    throw new WebhookPayloadError('invalid webhook payload');
  }

  return parsedWebhookEvent.data;
}
