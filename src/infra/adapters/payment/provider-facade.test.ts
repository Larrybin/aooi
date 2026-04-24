import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PaymentEventType,
  PaymentStatus,
  SubscriptionCycleType,
} from '@/domains/billing/domain/payment';
import { CreemProvider } from '@/infra/adapters/payment/creem';
import { PayPalProvider } from '@/infra/adapters/payment/paypal';
import { StripeProvider } from '@/infra/adapters/payment/stripe';

import { UpstreamError } from '@/shared/lib/api/errors';

test('StripeProvider façade 通过 transport + mapper 组装 renewal session', async () => {
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
            id: 'evt_123',
            type: 'invoice.payment_succeeded',
            data: {
              object: {
                id: 'in_123',
                amount_paid: 1200,
                currency: 'usd',
                created: 1711933200,
                billing_reason: 'subscription_cycle',
                lines: {
                  data: [{ subscription: 'sub_123' }],
                },
              },
            },
          }) as never,
        retrieveSubscription: async () =>
          ({
            id: 'sub_123',
            status: 'active',
            cancel_at: null,
            canceled_at: null,
            cancellation_details: null,
            items: {
              data: [
                {
                  current_period_start: 1711929600,
                  current_period_end: 1714521600,
                  plan: {
                    interval: 'month',
                    interval_count: 1,
                  },
                  price: {
                    id: 'price_123',
                    product: 'prod_123',
                    unit_amount: 1200,
                    currency: 'usd',
                  },
                },
              ],
            },
            metadata: {},
          }) as never,
      } as never,
    }
  );

  const event = await provider.getPaymentEvent({
    req: new Request('https://example.com', {
      method: 'POST',
      headers: {
        'stripe-signature': 'sig_123',
      },
      body: '{"ok":true}',
    }),
  });

  assert.equal(event.eventType, PaymentEventType.PAYMENT_SUCCESS);
  assert.equal(
    event.paymentSession.paymentInfo?.subscriptionCycleType,
    SubscriptionCycleType.RENEWAL
  );
  assert.equal(event.paymentSession.subscriptionId, 'sub_123');
});

test('StripeProvider façade 对 invoice.payment_failed 返回 canonical failed event', async () => {
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

  const event = await provider.getPaymentEvent({
    req: new Request('https://example.com', {
      method: 'POST',
      headers: {
        'stripe-signature': 'sig_123',
      },
      body: '{"ok":true}',
    }),
  });

  assert.equal(event.eventType, PaymentEventType.PAYMENT_FAILED);
  assert.equal(event.paymentSession.paymentStatus, PaymentStatus.FAILED);
  assert.deepEqual(event.paymentSession.metadata, {
    order_no: 'order_123',
    event_type: 'invoice.payment_failed',
    event_id: 'evt_failed_123',
  });
});

test('PayPalProvider façade 通过 transport 完成验签并读取订阅 session', async () => {
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
            event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
            resource: {
              id: 'sub_123',
            },
          }) as never,
        verifyWebhookSignature: async () => undefined,
        getSubscription: async () =>
          ({
            id: 'sub_123',
            status: 'CANCELLED',
            plan_id: 'plan_123',
            start_time: '2026-04-01T00:00:00.000Z',
            status_update_time: '2026-04-10T00:00:00.000Z',
            billing_info: {
              next_billing_time: '2026-05-01T00:00:00.000Z',
            },
          }) as never,
      } as never,
    }
  );

  const event = await provider.getPaymentEvent({
    req: new Request('https://example.com', {
      method: 'POST',
      body: '{}',
    }),
  });

  assert.equal(event.eventType, PaymentEventType.SUBSCRIBE_CANCELED);
  assert.equal(event.paymentSession.subscriptionId, 'sub_123');
});

test('PayPalProvider façade 对 PAYMENT.CAPTURE.COMPLETED 组装 renewal session', async () => {
  let verified = false;
  let requestedSubscriptionId = '';
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
        verifyWebhookSignature: async () => {
          verified = true;
        },
        getSubscription: async (subscriptionId: string) => {
          requestedSubscriptionId = subscriptionId;
          return {
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
          } as never;
        },
      } as never,
    }
  );

  const event = await provider.getPaymentEvent({
    req: new Request('https://example.com', {
      method: 'POST',
      body: '{}',
    }),
  });

  assert.equal(verified, true);
  assert.equal(requestedSubscriptionId, 'sub_123');
  assert.equal(event.eventType, PaymentEventType.PAYMENT_SUCCESS);
  assert.equal(
    event.paymentSession.paymentInfo?.subscriptionCycleType,
    SubscriptionCycleType.RENEWAL
  );
  assert.equal(event.paymentSession.subscriptionId, 'sub_123');
  assert.equal(event.paymentSession.paymentInfo?.transactionId, 'capture_123');
  assert.equal(event.paymentSession.paymentInfo?.invoiceId, 'inv_123');
});

test('PayPalProvider façade 对 PAYMENT.SALE.COMPLETED 组装 renewal session', async () => {
  let verified = false;
  let requestedSubscriptionId = '';
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
        verifyWebhookSignature: async () => {
          verified = true;
        },
        getSubscription: async (subscriptionId: string) => {
          requestedSubscriptionId = subscriptionId;
          return {
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
          } as never;
        },
      } as never,
    }
  );

  const event = await provider.getPaymentEvent({
    req: new Request('https://example.com', {
      method: 'POST',
      body: '{}',
    }),
  });

  assert.equal(verified, true);
  assert.equal(requestedSubscriptionId, 'sub_sale_123');
  assert.equal(event.eventType, PaymentEventType.PAYMENT_SUCCESS);
  assert.equal(
    event.paymentSession.paymentInfo?.subscriptionCycleType,
    SubscriptionCycleType.RENEWAL
  );
  assert.equal(event.paymentSession.subscriptionId, 'sub_sale_123');
  assert.equal(event.paymentSession.paymentInfo?.transactionId, 'sale_123');
  assert.equal(event.paymentSession.paymentInfo?.invoiceId, 'inv_sale_123');
});

test('PayPalProvider façade 在 renewal webhook 订阅响应为错误体时 fail-closed', async () => {
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
              supplementary_data: {
                related_ids: {
                  subscription_id: 'sub_123',
                },
              },
            },
          }) as never,
        verifyWebhookSignature: async () => undefined,
        getSubscription: async () =>
          ({
            error: {
              message: 'subscription lookup failed',
            },
          }) as never,
      } as never,
    }
  );

  await assert.rejects(
    () =>
      provider.getPaymentEvent({
        req: new Request('https://example.com', {
          method: 'POST',
          body: '{}',
        }),
      }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.message === 'subscription lookup failed'
  );
});

test('PayPalProvider façade 在 renewal webhook 订阅响应缺少关键字段时 fail-closed', async () => {
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
              supplementary_data: {
                related_ids: {
                  subscription_id: 'sub_123',
                },
              },
            },
          }) as never,
        verifyWebhookSignature: async () => undefined,
        getSubscription: async () =>
          ({
            id: 'sub_123',
            status: 'ACTIVE',
            billing_info: {},
          }) as never,
      } as never,
    }
  );

  await assert.rejects(
    () =>
      provider.getPaymentEvent({
        req: new Request('https://example.com', {
          method: 'POST',
          body: '{}',
        }),
      }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.message === 'invalid paypal subscription response'
  );
});

test('PayPalProvider façade 在订阅事件读取残缺订阅体时复用同一 fail-closed 校验', async () => {
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
            id: 'wh_evt_sub_123',
            event_type: 'BILLING.SUBSCRIPTION.UPDATED',
            resource: {
              id: 'sub_123',
            },
          }) as never,
        verifyWebhookSignature: async () => undefined,
        getSubscription: async () =>
          ({
            id: 'sub_123',
            status: 'ACTIVE',
            billing_info: {
              next_billing_time: '2026-05-01T00:00:00.000Z',
            },
          }) as never,
      } as never,
    }
  );

  await assert.rejects(
    () =>
      provider.getPaymentEvent({
        req: new Request('https://example.com', {
          method: 'POST',
          body: '{}',
        }),
      }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.message === 'invalid paypal subscription response'
  );
});

test('CreemProvider façade 通过 transport + mapper 组装 checkout session', async () => {
  const provider = new CreemProvider(
    {
      apiKey: 'creem-key',
      signingSecret: 'creem-secret',
    },
    {
      transport: {
        verifyWebhookEvent: async () =>
          ({
            eventType: 'checkout.completed',
            object: {
              id: 'checkout_123',
              status: 'paid',
              order: {
                status: 'paid',
                transaction: 'txn_123',
                amount_paid: 1200,
                currency: 'USD',
              },
              metadata: {
                order_no: 'order_123',
              },
            },
          }) as never,
      } as never,
    }
  );

  const event = await provider.getPaymentEvent({
    req: new Request('https://example.com', {
      method: 'POST',
      body: '{"ok":true}',
    }),
  });

  assert.equal(event.eventType, PaymentEventType.CHECKOUT_SUCCESS);
  assert.equal(event.paymentSession.paymentInfo?.transactionId, 'txn_123');
  assert.equal(event.paymentSession.metadata?.order_no, 'order_123');
});
