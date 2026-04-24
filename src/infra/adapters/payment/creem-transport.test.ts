import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { CreemTransport } from '@/infra/adapters/payment/creem-transport';

import { UpstreamError } from '@/shared/lib/api/errors';

test('Creem transport: request 失败时抛出 UpstreamError', async () => {
  const transport = new CreemTransport(
    {
      apiKey: 'creem-key',
    },
    {
      fetchJson: (async () => {
        throw new Error('network exploded');
      }) as never,
    }
  );

  await assert.rejects(
    () => transport.getCheckoutSession('checkout_123'),
    UpstreamError
  );
});

test('Creem transport: verifyWebhookEvent 复用 creem-webhook 纯函数校验', async () => {
  const rawBody = JSON.stringify({
    eventType: 'checkout.completed',
    object: {
      id: 'checkout_123',
    },
  });
  const signingSecret = 'creem-secret';
  const signature = createHmac('sha256', signingSecret)
    .update(rawBody)
    .digest('hex');

  const transport = new CreemTransport({
    apiKey: 'creem-key',
    signingSecret,
  });

  const event = await transport.verifyWebhookEvent({
    rawBody,
    signatureHeader: signature,
  });

  assert.equal(event.eventType, 'checkout.completed');
  assert.deepEqual(event.object, { id: 'checkout_123' });
});
