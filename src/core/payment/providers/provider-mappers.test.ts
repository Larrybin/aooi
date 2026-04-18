import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PaymentEventType,
  PaymentInterval,
  PaymentStatus,
  SubscriptionCycleType,
  SubscriptionStatus,
} from '@/core/payment/domain';
import {
  buildCreemPaymentSessionFromInvoice,
  buildCreemPaymentSessionFromSubscription,
} from '@/core/payment/providers/creem-mapper';
import {
  buildPayPalPaymentSession,
  buildPayPalWebhookPaymentSession,
  buildPayPalSubscriptionSession,
  extractPayPalWebhookSubscriptionId,
  mergePayPalRenewalSubscription,
} from '@/core/payment/providers/paypal-mapper';
import {
  buildStripeFailedPaymentSessionFromInvoice,
  buildStripePaymentSessionFromInvoice,
} from '@/core/payment/providers/stripe-mapper';

test('Stripe mapper: invoice mapper 保留 renewal 会话语义', async () => {
  const session = await buildStripePaymentSessionFromInvoice({
    provider: 'stripe',
    invoice: {
      id: 'in_123',
      amount_paid: 1200,
      currency: 'usd',
      customer_email: 'buyer@example.com',
      customer_name: 'Buyer',
      customer: 'cus_123',
      created: 1711933200,
      hosted_invoice_url: 'https://stripe.example.com/invoice/in_123',
      billing_reason: 'subscription_cycle',
      metadata: {
        order_no: 'order_123',
      },
      lines: {
        data: [
          {
            subscription: 'sub_123',
          },
        ],
      },
    } as never,
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
                id: 'price_monthly',
                product: 'prod_123',
                unit_amount: 1200,
                currency: 'usd',
              },
            },
          ],
        },
        metadata: {
          order_no: 'order_123',
        },
      }) as never,
  });

  assert.equal(session.provider, 'stripe');
  assert.equal(session.paymentStatus, PaymentStatus.SUCCESS);
  assert.equal(session.paymentInfo?.transactionId, 'in_123');
  assert.equal(session.paymentInfo?.invoiceId, 'in_123');
  assert.equal(
    session.paymentInfo?.subscriptionCycleType,
    SubscriptionCycleType.RENEWAL
  );
  assert.equal(session.subscriptionId, 'sub_123');
  assert.equal(session.subscriptionInfo?.status, SubscriptionStatus.ACTIVE);
  assert.equal(session.subscriptionInfo?.interval, PaymentInterval.MONTH);
  assert.equal(session.subscriptionInfo?.intervalCount, 1);
});

test('Stripe mapper: failed invoice mapper 返回非成功 session 且保留事件元数据', () => {
  const session = buildStripeFailedPaymentSessionFromInvoice({
    provider: 'stripe',
    invoice: {
      id: 'in_failed_123',
      metadata: {
        order_no: 'order_123',
      },
    } as never,
    event: {
      id: 'evt_failed_123',
      type: 'invoice.payment_failed',
    } as never,
  });

  assert.equal(session.provider, 'stripe');
  assert.equal(session.paymentStatus, PaymentStatus.FAILED);
  assert.equal(session.paymentResult && (session.paymentResult as { id: string }).id, 'in_failed_123');
  assert.deepEqual(session.metadata, {
    order_no: 'order_123',
    event_type: 'invoice.payment_failed',
    event_id: 'evt_failed_123',
  });
});

test('PayPal mapper: order session 保留 capture/invoice/order_no 字段', () => {
  const session = buildPayPalPaymentSession({
    provider: 'paypal',
    result: {
      id: 'order_123',
      status: 'COMPLETED',
      custom_id: 'order_no_123',
      purchase_units: [
        {
          custom_id: 'order_no_123',
          invoice_id: 'inv_123',
          amount: {
            value: '12.34',
            currency_code: 'USD',
          },
          payments: {
            captures: [
              {
                id: 'txn_123',
              },
            ],
          },
        },
      ],
      payer: {
        email_address: 'buyer@example.com',
      },
      metadata: {
        extra: 'value',
      },
    },
  });

  assert.equal(session.provider, 'paypal');
  assert.equal(session.paymentStatus, PaymentStatus.SUCCESS);
  assert.equal(session.paymentInfo?.transactionId, 'txn_123');
  assert.equal(session.paymentInfo?.invoiceId, 'inv_123');
  assert.equal(session.paymentInfo?.paymentAmount, 12.34);
  assert.equal(session.paymentInfo?.paymentCurrency, 'USD');
  assert.equal(session.paymentInfo?.paymentEmail, 'buyer@example.com');
  assert.deepEqual(session.metadata, {
    extra: 'value',
    order_no: 'order_no_123',
  });
});

test('PayPal mapper: webhook payment session 保留 capture/invoice/order_no 字段', () => {
  const session = buildPayPalWebhookPaymentSession({
    provider: 'paypal',
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
          order_id: 'order_123',
        },
      },
      metadata: {
        order_no: 'order_no_123',
      },
    },
  });

  assert.equal(session.provider, 'paypal');
  assert.equal(session.paymentStatus, PaymentStatus.SUCCESS);
  assert.equal(session.paymentInfo?.transactionId, 'capture_123');
  assert.equal(session.paymentInfo?.invoiceId, 'inv_123');
  assert.equal(session.paymentInfo?.paymentAmount, 12.34);
  assert.equal(session.paymentInfo?.paymentCurrency, 'USD');
  assert.equal(session.paymentInfo?.paymentEmail, 'buyer@example.com');
  assert.deepEqual(session.metadata, {
    order_no: 'order_no_123',
  });
});

test('PayPal mapper: webhook payment session 保留 sale/invoice/order_no 字段', () => {
  const session = buildPayPalWebhookPaymentSession({
    provider: 'paypal',
    resource: {
      id: 'sale_123',
      state: 'completed',
      invoice_id: 'inv_sale_123',
      amount: {
        value: '21.00',
        currency_code: 'USD',
      },
      payer: {
        email_address: 'sale-buyer@example.com',
      },
      supplementary_data: {
        related_ids: {
          subscription_id: 'sub_123',
        },
      },
      metadata: {
        order_no: 'order_sale_123',
      },
    },
  });

  assert.equal(session.provider, 'paypal');
  assert.equal(session.paymentStatus, PaymentStatus.SUCCESS);
  assert.equal(session.paymentInfo?.transactionId, 'sale_123');
  assert.equal(session.paymentInfo?.invoiceId, 'inv_sale_123');
  assert.equal(session.paymentInfo?.paymentAmount, 21);
  assert.equal(session.paymentInfo?.paymentCurrency, 'USD');
  assert.equal(session.paymentInfo?.paymentEmail, 'sale-buyer@example.com');
  assert.deepEqual(session.metadata, {
    order_no: 'order_sale_123',
  });
});

test('PayPal mapper: renewal merge 补齐 subscription context 与 renewal 语义', () => {
  const subscriptionId = extractPayPalWebhookSubscriptionId({
    supplementary_data: {
      related_ids: {
        subscription_id: 'sub_123',
      },
    },
  });

  assert.equal(subscriptionId, 'sub_123');

  const session = mergePayPalRenewalSubscription({
    session: buildPayPalWebhookPaymentSession({
      provider: 'paypal',
      resource: {
        id: 'capture_123',
        status: 'COMPLETED',
        amount: {
          value: '12.34',
          currency_code: 'USD',
        },
        payer: {
          email_address: 'buyer@example.com',
        },
      },
    }),
    subscriptionId: subscriptionId || '',
    subscription: {
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
    },
  });

  assert.equal(session.subscriptionId, 'sub_123');
  assert.equal(
    session.paymentInfo?.subscriptionCycleType,
    SubscriptionCycleType.RENEWAL
  );
  assert.equal(session.subscriptionInfo?.status, SubscriptionStatus.ACTIVE);
  assert.equal(
    session.subscriptionInfo?.currentPeriodEnd.toISOString(),
    '2026-05-01T00:00:00.000Z'
  );
});

test('PayPal mapper: subscription session 保留取消订阅区间语义', () => {
  const session = buildPayPalSubscriptionSession({
    provider: 'paypal',
    subscriptionId: 'sub_123',
    eventType: PaymentEventType.SUBSCRIBE_CANCELED,
    subscription: {
      status: 'CANCELLED',
      plan_id: 'plan_123',
      start_time: '2026-04-01T00:00:00.000Z',
      status_update_time: '2026-04-10T00:00:00.000Z',
      billing_info: {
        next_billing_time: '2026-05-01T00:00:00.000Z',
      },
      metadata: {
        order_no: 'order_123',
      },
    },
  });

  assert.equal(session.provider, 'paypal');
  assert.equal(session.paymentStatus, PaymentStatus.CANCELED);
  assert.equal(session.subscriptionId, 'sub_123');
  assert.equal(session.subscriptionInfo?.status, SubscriptionStatus.CANCELED);
  assert.equal(
    session.subscriptionInfo?.currentPeriodStart.toISOString(),
    '2026-04-01T00:00:00.000Z'
  );
  assert.equal(
    session.subscriptionInfo?.currentPeriodEnd.toISOString(),
    '2026-05-01T00:00:00.000Z'
  );
  assert.equal(
    session.subscriptionInfo?.canceledAt?.toISOString(),
    '2026-04-10T00:00:00.000Z'
  );
});

test('Creem mapper: invoice 保留 renewal 与订阅信息', async () => {
  const session = await buildCreemPaymentSessionFromInvoice({
    provider: 'creem',
    invoice: {
      status: 'paid',
      metadata: {
        order_no: 'order_123',
      },
      order: {
        status: 'paid',
        transaction: 'txn_123',
        id: 'ord_123',
        description: 'Pro Plan',
        amount: 1200,
        amount_paid: 1200,
        currency: 'USD',
        discount_amount: 0,
        created_at: '2026-04-01T00:00:00.000Z',
      },
      customer: {
        id: 'cus_123',
        name: 'Buyer',
        email: 'buyer@example.com',
      },
      subscription: {
        id: 'sub_123',
        status: 'active',
        created_at: '2026-03-01T00:00:00.000Z',
        current_period_start_date: '2026-04-01T00:00:10.000Z',
        current_period_end_date: '2026-05-01T00:00:10.000Z',
        product: {
          id: 'prod_123',
          billing_period: 'every-month',
          description: 'Pro Plan',
          price: 1200,
          currency: 'USD',
        },
        metadata: {
          plan: 'pro',
        },
      },
    },
  });

  assert.equal(session.provider, 'creem');
  assert.equal(session.paymentStatus, PaymentStatus.SUCCESS);
  assert.equal(session.paymentInfo?.transactionId, 'txn_123');
  assert.equal(session.paymentInfo?.paymentAmount, 1200);
  assert.equal(session.paymentInfo?.paymentCurrency, 'USD');
  assert.equal(
    session.paymentInfo?.subscriptionCycleType,
    SubscriptionCycleType.RENEWAL
  );
  assert.equal(session.subscriptionId, 'sub_123');
  assert.equal(session.subscriptionInfo?.status, SubscriptionStatus.ACTIVE);
  assert.equal(session.subscriptionInfo?.interval, PaymentInterval.MONTH);
  assert.equal(session.subscriptionInfo?.intervalCount, 1);
});

test('Creem mapper: subscription session 保留 canceled 订阅状态', async () => {
  const session = await buildCreemPaymentSessionFromSubscription({
    provider: 'creem',
    subscription: {
      id: 'sub_123',
      status: 'canceled',
      canceled_at: '2026-04-10T00:00:00.000Z',
      current_period_start_date: '2026-04-01T00:00:00.000Z',
      current_period_end_date: '2026-05-01T00:00:00.000Z',
      product: {
        id: 'prod_123',
        billing_period: 'every-month',
      },
    },
  });

  assert.equal(session.provider, 'creem');
  assert.equal(session.subscriptionId, 'sub_123');
  assert.equal(session.subscriptionInfo?.status, SubscriptionStatus.CANCELED);
  assert.equal(
    session.subscriptionInfo?.canceledAt?.toISOString(),
    '2026-04-10T00:00:00.000Z'
  );
});
