import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import {
  WebhookPayloadError,
  WebhookVerificationError,
} from '@/core/payment/domain';
import {
  generateCreemWebhookSignature,
  normalizeCreemWebhookSignature,
  verifyAndParseCreemWebhookEvent,
} from '@/core/payment/providers/creem-webhook';

test('generateCreemWebhookSignature 生成与 HMAC-SHA256 一致的签名', async () => {
  const payload = JSON.stringify({
    eventType: 'checkout.completed',
    object: { id: 'checkout_123' },
  });
  const secret = 'creem-secret';

  const signature = await generateCreemWebhookSignature(payload, secret);
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  assert.equal(signature, expected);
});

test('normalizeCreemWebhookSignature 拒绝非法签名格式', () => {
  assert.throws(
    () => normalizeCreemWebhookSignature('not-a-valid-signature'),
    WebhookVerificationError
  );
});

test('verifyAndParseCreemWebhookEvent 接受合法 webhook', async () => {
  const payload = JSON.stringify({
    eventType: 'checkout.completed',
    object: { id: 'checkout_123' },
  });
  const signingSecret = 'creem-secret';
  const signature = createHmac('sha256', signingSecret)
    .update(payload)
    .digest('hex');

  const event = await verifyAndParseCreemWebhookEvent({
    rawBody: payload,
    signatureHeader: signature,
    signingSecret,
  });

  assert.equal(event.eventType, 'checkout.completed');
  assert.deepEqual(event.object, { id: 'checkout_123' });
});

test('verifyAndParseCreemWebhookEvent 拒绝错误签名', async () => {
  await assert.rejects(
    verifyAndParseCreemWebhookEvent({
      rawBody: JSON.stringify({
        eventType: 'checkout.completed',
        object: { id: 'checkout_123' },
      }),
      signatureHeader: '0'.repeat(64),
      signingSecret: 'creem-secret',
    }),
    WebhookVerificationError
  );
});

test('verifyAndParseCreemWebhookEvent 拒绝非法 payload', async () => {
  const signingSecret = 'creem-secret';
  const payload = '{"eventType":"checkout.completed"}';
  const signature = createHmac('sha256', signingSecret)
    .update(payload)
    .digest('hex');

  await assert.rejects(
    verifyAndParseCreemWebhookEvent({
      rawBody: payload,
      signatureHeader: signature,
      signingSecret,
    }),
    WebhookPayloadError
  );
});
