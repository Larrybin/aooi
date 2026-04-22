import assert from 'node:assert/strict';
import test from 'node:test';

import { handlePaymentNotifyRequest } from '@/domains/billing/application/payment-notify-flow';
import {
  PaymentEventType,
  WebhookPayloadError,
  WebhookVerificationError,
  type PaymentEvent,
} from '@/domains/billing/domain/payment';
import { PayPalProvider } from '@/infra/adapters/payment/paypal';
import { StripeProvider } from '@/infra/adapters/payment/stripe';
import { PayloadTooLargeError, UpstreamError } from '@/shared/lib/api/errors';

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

test('payment notify flow 在 provider 早期失败时不会把已终态 inbox 降级成 process_failed', async () => {
  let attempted = false;
  let processFailed = false;
  let processFailureHookCalled = false;
  let providerCalled = false;

  const response = await handlePaymentNotifyRequest({
    provider: 'paypal',
    req: new Request('https://example.com/api/payment/notify/paypal', {
      method: 'POST',
      body: '{}',
    }),
    log: createLog(),
    deps: createDeps({
      getPaymentEvent: async () => {
        providerCalled = true;
        throw new UpstreamError(502, 'transient upstream failure');
      },
      createPaymentWebhookInboxReceipt: async () => ({
        record: createInboxRecord({ status: 'processed' }),
        isNew: false,
      }),
      markPaymentWebhookInboxAttempt: async () => {
        attempted = true;
        return undefined;
      },
      markPaymentWebhookInboxProcessFailed: async () => {
        processFailed = true;
        return undefined;
      },
      onProcessFailure: async () => {
        processFailureHookCalled = true;
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'already processed' },
  });
  assert.equal(providerCalled, true);
  assert.equal(attempted, false);
  assert.equal(processFailed, false);
  assert.equal(processFailureHookCalled, false);
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

test('payment notify flow 通过真实 Stripe provider 处理 invoice.payment_failed 并返回 processed', async () => {
  const warnings: Array<Record<string, unknown>> = [];
  let checkoutHandled = false;
  let renewalHandled = false;
  let canceledHandled = false;
  let updatedHandled = false;

  const provider = new StripeProvider(
    {
      secretKey: 'sk_test',
      publishableKey: 'pk_test',
      signingSecret: 'whsec_test',
    },
    {
      transport: {
        constructWebhookEvent: () =>
          ({
            id: 'evt_failed_123',
            type: 'invoice.payment_failed',
            data: {
              object: {
                id: 'in_failed_123',
                metadata: {
                  order_no: 'order_123',
                },
              },
            },
          }) as never,
      } as never,
    }
  );

  const response = await handlePaymentNotifyRequest({
    provider: 'stripe',
    req: new Request('https://example.com/api/payment/notify/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': 'sig_123',
      },
      body: '{"ok":true}',
    }),
    log: {
      ...createLog(),
      warn: (_message: string, meta?: Record<string, unknown>) => {
        warnings.push(meta || {});
      },
    },
    deps: createDeps({
      getPaymentEvent: async (req: Request) =>
        await provider.getPaymentEvent({ req }),
      handleCheckoutSuccess: async () => {
        checkoutHandled = true;
      },
      handleSubscriptionRenewal: async () => {
        renewalHandled = true;
      },
      handleSubscriptionCanceled: async () => {
        canceledHandled = true;
      },
      handleSubscriptionUpdated: async () => {
        updatedHandled = true;
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'success' },
  });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.eventType, PaymentEventType.PAYMENT_FAILED);
  assert.equal(checkoutHandled, false);
  assert.equal(renewalHandled, false);
  assert.equal(canceledHandled, false);
  assert.equal(updatedHandled, false);
});

test('payment notify flow 通过真实 PayPal provider 处理 renewal payment success', async () => {
  let renewalTransactionId = '';
  let renewalInvoiceId = '';
  let renewalSubscriptionId = '';

  const provider = new PayPalProvider(
    {
      clientId: 'client',
      clientSecret: 'secret',
      webhookId: 'wh_123',
    },
    {
      transport: {
        parseWebhookEvent: () =>
          ({
            id: 'wh_evt_123',
            event_type: 'PAYMENT.CAPTURE.COMPLETED',
            resource: {
              id: 'capture_123',
              status: 'COMPLETED',
              invoice_id: 'inv_123',
              amount: {
                value: '12.34',
                currency_code: 'USD',
              },
              payer: {
                email_address: 'buyer@example.com',
              },
              supplementary_data: {
                related_ids: {
                  subscription_id: 'sub_123',
                },
              },
              metadata: {
                order_no: 'order_123',
              },
            },
          }) as never,
        verifyWebhookSignature: async () => undefined,
        getSubscription: async () =>
          ({
            id: 'sub_123',
            status: 'ACTIVE',
            plan_id: 'plan_123',
            start_time: '2026-04-01T00:00:00.000Z',
            billing_info: {
              last_payment: {
                time: '2026-04-01T00:00:00.000Z',
                amount: {
                  value: '12.34',
                  currency_code: 'USD',
                },
              },
              next_billing_time: '2026-05-01T00:00:00.000Z',
            },
          }) as never,
      } as never,
    }
  );

  const response = await handlePaymentNotifyRequest({
    provider: 'paypal',
    req: new Request('https://example.com/api/payment/notify/paypal', {
      method: 'POST',
      headers: {
        'paypal-auth-algo': 'algo',
        'paypal-cert-id': 'cert',
        'paypal-transmission-id': 'tx_id',
        'paypal-transmission-sig': 'sig',
        'paypal-transmission-time': '2026-04-17T10:00:00.000Z',
      },
      body: '{}',
    }),
    log: createLog(),
    deps: createDeps({
      getPaymentEvent: async (req: Request) =>
        await provider.getPaymentEvent({ req }),
      findSubscriptionByProviderSubscriptionId: async () => ({
        subscriptionNo: 'sub_no_1',
        status: 'active',
      }),
      handleSubscriptionRenewal: async ({
        session,
      }: {
        session: {
          subscriptionId?: string;
          paymentInfo?: {
            transactionId?: string;
            invoiceId?: string;
          };
        };
      }) => {
        renewalSubscriptionId = session.subscriptionId || '';
        renewalTransactionId = session.paymentInfo?.transactionId || '';
        renewalInvoiceId = session.paymentInfo?.invoiceId || '';
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'success' },
  });
  assert.equal(renewalSubscriptionId, 'sub_123');
  assert.equal(renewalTransactionId, 'capture_123');
  assert.equal(renewalInvoiceId, 'inv_123');
});

test('payment notify flow 通过真实 PayPal provider 处理 renewal sale success', async () => {
  let renewalTransactionId = '';
  let renewalInvoiceId = '';
  let renewalSubscriptionId = '';

  const provider = new PayPalProvider(
    {
      clientId: 'client',
      clientSecret: 'secret',
      webhookId: 'wh_123',
    },
    {
      transport: {
        parseWebhookEvent: () =>
          ({
            id: 'wh_evt_sale_123',
            event_type: 'PAYMENT.SALE.COMPLETED',
            resource: {
              id: 'sale_123',
              state: 'completed',
              invoice_id: 'inv_sale_123',
              amount: {
                value: '21.00',
                currency_code: 'USD',
              },
              payer: {
                email_address: 'buyer@example.com',
              },
              supplementary_data: {
                related_ids: {
                  subscription_id: 'sub_sale_123',
                },
              },
              metadata: {
                order_no: 'order_sale_123',
              },
            },
          }) as never,
        verifyWebhookSignature: async () => undefined,
        getSubscription: async () =>
          ({
            id: 'sub_sale_123',
            status: 'ACTIVE',
            plan_id: 'plan_123',
            start_time: '2026-04-01T00:00:00.000Z',
            billing_info: {
              last_payment: {
                time: '2026-04-01T00:00:00.000Z',
                amount: {
                  value: '21.00',
                  currency_code: 'USD',
                },
              },
              next_billing_time: '2026-05-01T00:00:00.000Z',
            },
          }) as never,
      } as never,
    }
  );

  const response = await handlePaymentNotifyRequest({
    provider: 'paypal',
    req: new Request('https://example.com/api/payment/notify/paypal', {
      method: 'POST',
      headers: {
        'paypal-auth-algo': 'algo',
        'paypal-cert-id': 'cert',
        'paypal-transmission-id': 'tx_id',
        'paypal-transmission-sig': 'sig',
        'paypal-transmission-time': '2026-04-17T10:00:00.000Z',
      },
      body: '{}',
    }),
    log: createLog(),
    deps: createDeps({
      getPaymentEvent: async (req: Request) =>
        await provider.getPaymentEvent({ req }),
      findSubscriptionByProviderSubscriptionId: async () => ({
        subscriptionNo: 'sub_no_sale_1',
        status: 'active',
      }),
      handleSubscriptionRenewal: async ({
        session,
      }: {
        session: {
          subscriptionId?: string;
          paymentInfo?: {
            transactionId?: string;
            invoiceId?: string;
          };
        };
      }) => {
        renewalSubscriptionId = session.subscriptionId || '';
        renewalTransactionId = session.paymentInfo?.transactionId || '';
        renewalInvoiceId = session.paymentInfo?.invoiceId || '';
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'success' },
  });
  assert.equal(renewalSubscriptionId, 'sub_sale_123');
  assert.equal(renewalTransactionId, 'sale_123');
  assert.equal(renewalInvoiceId, 'inv_sale_123');
});

test('payment notify flow 在 PayPal renewal 订阅详情无效时标记 inbox process_failed', async () => {
  const processFailures: string[] = [];
  const attempts: string[] = [];
  let inboxCreated = false;

  const provider = new PayPalProvider(
    {
      clientId: 'client',
      clientSecret: 'secret',
      webhookId: 'wh_123',
    },
    {
      transport: {
        parseWebhookEvent: () =>
          ({
            id: 'wh_evt_invalid_sub_123',
            event_type: 'PAYMENT.CAPTURE.COMPLETED',
            resource: {
              id: 'capture_123',
              status: 'COMPLETED',
              supplementary_data: {
                related_ids: {
                  subscription_id: 'sub_invalid_123',
                },
              },
            },
          }) as never,
        verifyWebhookSignature: async () => undefined,
        getSubscription: async () =>
          ({
            id: 'sub_invalid_123',
            status: 'ACTIVE',
            billing_info: {},
          }) as never,
      } as never,
    }
  );

  await assert.rejects(
    () =>
      handlePaymentNotifyRequest({
        provider: 'paypal',
        req: new Request('https://example.com/api/payment/notify/paypal', {
          method: 'POST',
          headers: {
            'paypal-auth-algo': 'algo',
            'paypal-cert-id': 'cert',
            'paypal-transmission-id': 'tx_id',
            'paypal-transmission-sig': 'sig',
            'paypal-transmission-time': '2026-04-17T10:00:00.000Z',
          },
          body: '{}',
        }),
        log: createLog(),
        deps: createDeps({
          getPaymentEvent: async (req: Request) =>
            await provider.getPaymentEvent({ req }),
          createPaymentWebhookInboxReceipt: async () => {
            inboxCreated = true;
            return {
              record: createInboxRecord(),
              isNew: true,
            };
          },
          markPaymentWebhookInboxAttempt: async ({
            inboxId,
          }: {
            inboxId: string;
          }) => {
            attempts.push(inboxId);
            return undefined;
          },
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
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.message === 'invalid paypal subscription response'
  );

  assert.equal(inboxCreated, true);
  assert.deepEqual(attempts, ['inbox_1']);
  assert.deepEqual(processFailures, [
    'inbox_1:UpstreamError: invalid paypal subscription response',
  ]);
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
