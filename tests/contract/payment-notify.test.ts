import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PaymentEventType,
  SubscriptionCycleType,
} from '@/extensions/payment';

import { processPaymentNotifyEvent } from '@/app/api/payment/notify/[provider]/process-payment-notify';

function createLog() {
  return {
    debug: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    info: () => undefined,
  };
}

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    findOrderByInvoiceId: async () => null,
    findOrderByOrderNo: async () => null,
    findOrderByTransactionId: async () => null,
    findSubscriptionByProviderSubscriptionId: async () => null,
    handleCheckoutSuccess: async () => undefined,
    handleSubscriptionCanceled: async () => undefined,
    handleSubscriptionRenewal: async () => undefined,
    handleSubscriptionUpdated: async () => undefined,
    ...overrides,
  };
}

test('processPaymentNotifyEvent 在首次 checkout webhook 时处理成功', async () => {
  let handled = false;
  const response = await processPaymentNotifyEvent({
    provider: 'creem',
    log: createLog() as never,
    event: {
      eventType: PaymentEventType.CHECKOUT_SUCCESS,
      eventResult: {},
      paymentSession: {
        provider: 'creem',
        metadata: { order_no: 'order_123' },
      },
    },
    deps: createDeps({
      findOrderByOrderNo: async () => ({
        orderNo: 'order_123',
        status: 'created',
      }),
      handleCheckoutSuccess: async () => {
        handled = true;
      },
    }) as never,
  });

  assert.equal(handled, true);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'success' },
  });
});

test('processPaymentNotifyEvent 对重复 renewal webhook 命中幂等', async () => {
  let renewalHandled = false;
  const response = await processPaymentNotifyEvent({
    provider: 'creem',
    log: createLog() as never,
    event: {
      eventType: PaymentEventType.PAYMENT_SUCCESS,
      eventResult: {},
      paymentSession: {
        provider: 'creem',
        subscriptionId: 'sub_123',
        subscriptionInfo: {
          currentPeriodStart: '2026-04-01T00:00:00.000Z',
          currentPeriodEnd: '2026-05-01T00:00:00.000Z',
        },
        paymentInfo: {
          subscriptionCycleType: SubscriptionCycleType.RENEWAL,
          transactionId: 'txn_123',
          invoiceId: 'inv_123',
        },
      },
    },
    deps: createDeps({
      findOrderByTransactionId: async () => ({ orderNo: 'existing_order' }),
      handleSubscriptionRenewal: async () => {
        renewalHandled = true;
      },
    }) as never,
  });

  assert.equal(renewalHandled, false);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'already processed' },
  });
});

test('processPaymentNotifyEvent 在订阅取消后不重复处理 update 事件', async () => {
  let updateHandled = false;
  const response = await processPaymentNotifyEvent({
    provider: 'creem',
    log: createLog() as never,
    event: {
      eventType: PaymentEventType.SUBSCRIBE_UPDATED,
      eventResult: {},
      paymentSession: {
        provider: 'creem',
        subscriptionId: 'sub_123',
        subscriptionInfo: {
          currentPeriodStart: '2026-04-01T00:00:00.000Z',
          currentPeriodEnd: '2026-05-01T00:00:00.000Z',
        },
      },
    },
    deps: createDeps({
      findSubscriptionByProviderSubscriptionId: async () => ({
        subscriptionNo: 'sub_no_1',
        status: 'canceled',
      }),
      handleSubscriptionUpdated: async () => {
        updateHandled = true;
      },
    }) as never,
  });

  assert.equal(updateHandled, false);
  assert.deepEqual(await response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'already processed' },
  });
});
