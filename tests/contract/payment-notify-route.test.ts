import assert from 'node:assert/strict';
import test from 'node:test';

import { handlePaymentNotifyRequest } from '@/core/payment/webhooks/payment-notify-flow';
import {
  PaymentEventType,
  WebhookPayloadError,
  WebhookVerificationError,
  type PaymentEvent,
} from '@/core/payment/domain';
import { PayloadTooLargeError } from '@/shared/lib/api/errors';

function createInboxRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inbox_1',
    status: 'received',
    ...overrides,
  };
}

function createLog() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    findOrderByInvoiceId: async () => null,
    findOrderByOrderNo: async () => ({
      orderNo: 'order_1',
      status: 'created',
    }),
    findOrderByTransactionId: async () => null,
    findSubscriptionByProviderSubscriptionId: async () => null,
    recordUnknownWebhookEvent: async () => undefined,
    handleCheckoutSuccess: async () => undefined,
    handleSubscriptionCanceled: async () => undefined,
    handleSubscriptionRenewal: async () => undefined,
    handleSubscriptionUpdated: async () => undefined,
    createPaymentWebhookInboxReceipt: async () => ({
      record: createInboxRecord(),
      isNew: true,
    }),
    recordPaymentWebhookInboxCanonicalEvent: async () => undefined,
    markPaymentWebhookInboxAttempt: async () => undefined,
    markPaymentWebhookInboxParseFailed: async () => undefined,
    markPaymentWebhookInboxProcessFailed: async () => undefined,
    markPaymentWebhookInboxProcessed: async () => undefined,
    serializePaymentWebhookHeaders: (headers: Headers) =>
      JSON.stringify(Object.fromEntries(headers.entries())),
    getPaymentEvent: async () => {
      throw new Error('getPaymentEvent override required');
    },
    now: () => new Date('2026-04-17T10:00:00.000Z'),
    ...overrides,
  };
}

test('payment notify flow 验签成功后写 inbox 并处理 canonical event', async () => {
  const attempts: string[] = [];
  const canonicalEvents: PaymentEvent[] = [];
  const processed: Array<{ inboxId: string; eventType: PaymentEventType }> = [];
  const steps: string[] = [];
  const event: PaymentEvent = {
    eventType: PaymentEventType.UNKNOWN,
    eventResult: { source: 'webhook', kind: 'unmapped' },
    paymentSession: {
      provider: 'creem',
      metadata: {
        event_type: 'CREEM.UNKNOWN',
        event_id: 'evt_1',
      },
    },
  };

  const response = await handlePaymentNotifyRequest({
    provider: 'creem',
    req: new Request('https://example.com/api/payment/notify/creem', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{"ok":1}',
    }),
    log: createLog(),
    deps: createDeps({
      getPaymentEvent: async (req: Request) => {
        steps.push('getPaymentEvent');
        assert.equal(await req.text(), '{"ok":1}');
        return event;
      },
      createPaymentWebhookInboxReceipt: async (input: {
        provider: string;
        rawBody: string;
        rawHeaders: string;
      }) => {
        steps.push('createPaymentWebhookInboxReceipt');
        assert.equal(input.provider, 'creem');
        assert.equal(input.rawBody, '{"ok":1}');
        assert.match(input.rawHeaders, /content-type/i);
        return {
          record: createInboxRecord(),
          isNew: true,
        };
      },
      markPaymentWebhookInboxAttempt: async ({ inboxId }: { inboxId: string }) => {
        attempts.push(inboxId);
        return undefined;
      },
      recordPaymentWebhookInboxCanonicalEvent: async ({
        event: canonicalEvent,
      }: {
        event: PaymentEvent;
      }) => {
        canonicalEvents.push(canonicalEvent);
        return undefined;
      },
      markPaymentWebhookInboxProcessed: async ({
        inboxId,
        eventType,
      }: {
        inboxId: string;
        eventType: PaymentEventType;
      }) => {
        processed.push({ inboxId, eventType });
        return undefined;
      },
    }),
  });

  assert.deepEqual(steps, ['getPaymentEvent', 'createPaymentWebhookInboxReceipt']);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'ignored' },
  });
  assert.deepEqual(attempts, ['inbox_1']);
  assert.deepEqual(canonicalEvents, [event]);
  assert.deepEqual(processed, [
    {
      inboxId: 'inbox_1',
      eventType: PaymentEventType.UNKNOWN,
    },
  ]);
});

test('payment notify flow 对已终态 inbox 直接返回幂等响应', async () => {
  let attempted = false;
  let providerCalled = false;

  const response = await handlePaymentNotifyRequest({
    provider: 'creem',
    req: new Request('https://example.com/api/payment/notify/creem', {
      method: 'POST',
      body: '{}',
    }),
    log: createLog(),
    deps: createDeps({
      getPaymentEvent: async () => {
        providerCalled = true;
        return {
          eventType: PaymentEventType.UNKNOWN,
          eventResult: {},
          paymentSession: {
            provider: 'creem',
            metadata: {},
          },
        };
      },
      createPaymentWebhookInboxReceipt: async () => ({
        record: createInboxRecord({ status: 'processed' }),
        isNew: false,
      }),
      markPaymentWebhookInboxAttempt: async () => {
        attempted = true;
        return undefined;
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'already processed' },
  });
  assert.equal(attempted, false);
  assert.equal(providerCalled, true);
});

test('payment notify flow 在 payload 非法时不会写 inbox', async () => {
  let inboxCreated = false;
  let attempted = false;

  await assert.rejects(
    () =>
      handlePaymentNotifyRequest({
        provider: 'creem',
        req: new Request('https://example.com/api/payment/notify/creem', {
          method: 'POST',
          body: '{}',
        }),
        log: createLog(),
        deps: createDeps({
          getPaymentEvent: async () => {
            throw new WebhookPayloadError('invalid webhook payload');
          },
          createPaymentWebhookInboxReceipt: async () => {
            inboxCreated = true;
            return {
              record: createInboxRecord(),
              isNew: true,
            };
          },
          markPaymentWebhookInboxAttempt: async () => {
            attempted = true;
            return undefined;
          },
        }),
      }),
    /invalid webhook payload/
  );

  assert.equal(inboxCreated, false);
  assert.equal(attempted, false);
});

test('payment notify flow 在验签失败时不会写 inbox', async () => {
  let inboxCreated = false;

  await assert.rejects(
    () =>
      handlePaymentNotifyRequest({
        provider: 'creem',
        req: new Request('https://example.com/api/payment/notify/creem', {
          method: 'POST',
          body: '{}',
        }),
        log: createLog(),
        deps: createDeps({
          getPaymentEvent: async () => {
            throw new WebhookVerificationError('invalid webhook signature');
          },
          createPaymentWebhookInboxReceipt: async () => {
            inboxCreated = true;
            return {
              record: createInboxRecord(),
              isNew: true,
            };
          },
        }),
      }),
    /invalid webhook signature/
  );

  assert.equal(inboxCreated, false);
});

test('payment notify flow 在 body 超限时返回 413 且不会解析或写 inbox', async () => {
  let inboxCreated = false;
  let providerCalled = false;

  await assert.rejects(
    () =>
      handlePaymentNotifyRequest({
        provider: 'creem',
        req: new Request('https://example.com/api/payment/notify/creem', {
          method: 'POST',
          headers: {
            'content-length': String(256 * 1024 + 1),
          },
          body: '{}',
        }),
        log: createLog(),
        deps: createDeps({
          getPaymentEvent: async () => {
            providerCalled = true;
            throw new Error('should not be called');
          },
          createPaymentWebhookInboxReceipt: async () => {
            inboxCreated = true;
            return {
              record: createInboxRecord(),
              isNew: true,
            };
          },
        }),
      }),
    (error) => {
      assert.equal(error instanceof PayloadTooLargeError, true);
      return true;
    }
  );

  assert.equal(providerCalled, false);
  assert.equal(inboxCreated, false);
});

test('payment notify flow 在 process 失败时标记 inbox process_failed', async () => {
  const processFailures: string[] = [];
  const event: PaymentEvent = {
    eventType: PaymentEventType.CHECKOUT_SUCCESS,
    eventResult: {},
    paymentSession: {
      provider: 'creem',
      metadata: {
        order_no: 'order_missing',
      },
    },
  };

  await assert.rejects(
    () =>
      handlePaymentNotifyRequest({
        provider: 'creem',
        req: new Request('https://example.com/api/payment/notify/creem', {
          method: 'POST',
          body: '{}',
        }),
        log: createLog(),
        deps: createDeps({
          getPaymentEvent: async () => event,
          findOrderByOrderNo: async () => null,
          markPaymentWebhookInboxProcessFailed: async ({
            inboxId,
            error,
          }: {
            inboxId: string;
            error: unknown;
          }) => {
            processFailures.push(`${inboxId}:${String(error)}`);
            return undefined;
          },
        }),
      }),
    /order not found/
  );

  assert.deepEqual(processFailures, ['inbox_1:NotFoundError: order not found']);
});
