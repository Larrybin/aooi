import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PaymentEventType,
  SubscriptionCycleType,
} from '@/core/payment/domain';

import { processPaymentNotifyEvent } from '@/core/payment/webhooks/process-payment-notify';

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
    recordUnknownWebhookEvent: async () => undefined,
    handleCheckoutSuccess: async () => undefined,
    handleSubscriptionCanceled: async () => undefined,
    handleSubscriptionRenewal: async () => undefined,
    handleSubscriptionUpdated: async () => undefined,
    ...overrides,
  };
}

test('processPaymentNotifyEvent 在首次 checkout webhook 时处理成功', async () => {
  let handled = false;
  const result = await processPaymentNotifyEvent({
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
  assert.equal(result.response.status, 200);
  assert.deepEqual(await result.response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'success' },
  });
});

test('processPaymentNotifyEvent 对重复 renewal webhook 命中幂等', async () => {
  let renewalHandled = false;
  const result = await processPaymentNotifyEvent({
    provider: 'creem',
    log: createLog() as never,
    event: {
      eventType: PaymentEventType.PAYMENT_SUCCESS,
      eventResult: {},
      paymentSession: {
        provider: 'creem',
        subscriptionId: 'sub_123',
        subscriptionInfo: {
          subscriptionId: 'sub_123',
          currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        },
        paymentInfo: {
          paymentAmount: 100,
          paymentCurrency: 'USD',
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
  assert.equal(result.response.status, 200);
  assert.deepEqual(await result.response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'already processed' },
  });
});

test('processPaymentNotifyEvent 在订阅取消后不重复处理 update 事件', async () => {
  let updateHandled = false;
  const result = await processPaymentNotifyEvent({
    provider: 'creem',
    log: createLog() as never,
    event: {
      eventType: PaymentEventType.SUBSCRIBE_UPDATED,
      eventResult: {},
      paymentSession: {
        provider: 'creem',
        subscriptionId: 'sub_123',
        subscriptionInfo: {
          subscriptionId: 'sub_123',
          currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
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
  assert.deepEqual(await result.response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'already processed' },
  });
});

test('processPaymentNotifyEvent 对 unknown 事件执行审计并忽略', async () => {
  const warns: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const result = await processPaymentNotifyEvent({
    provider: 'paypal',
    log: {
      ...createLog(),
      warn: (_message: string, meta?: Record<string, unknown>) => {
        warns.push(meta || {});
      },
    } as never,
    event: {
      eventType: PaymentEventType.UNKNOWN,
      eventResult: { source: 'webhook', kind: 'unmapped' },
      paymentSession: {
        provider: 'paypal',
        paymentStatus: 'processing' as never,
        metadata: {
          event_type: 'PAYPAL.UNKNOWN',
          event_id: 'evt_123',
        },
      },
    },
    deps: createDeps({
      recordUnknownWebhookEvent: async (audit: {
        provider: string;
        eventType: string;
        eventId?: string | null;
        rawDigest: string;
        receivedAt: Date;
      }) => {
        audits.push({
          ...audit,
          receivedAt: audit.receivedAt.toISOString(),
        });
      },
    }) as never,
  });

  assert.equal(result.response.status, 200);
  assert.equal(warns.length, 1);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.provider, 'paypal');
  assert.equal(audits[0]?.eventType, 'PAYPAL.UNKNOWN');
  assert.equal(audits[0]?.eventId, 'evt_123');
  assert.match(String(audits[0]?.rawDigest || ''), /^[0-9a-f]{64}$/);
  assert.equal(warns[0]?.provider, 'paypal');
  assert.equal(warns[0]?.eventType, PaymentEventType.UNKNOWN);
  assert.deepEqual(await result.response.json(), {
    code: 0,
    message: 'ok',
    data: { message: 'ignored' },
  });
});

test('processPaymentNotifyEvent 在 unknown 审计写入失败时返回错误并阻断后续迁移', async () => {
  let checkoutHandled = false;
  let renewalHandled = false;
  let canceledHandled = false;
  let updatedHandled = false;

  await assert.rejects(
    async () =>
      processPaymentNotifyEvent({
        provider: 'paypal',
        log: createLog() as never,
        event: {
          eventType: PaymentEventType.UNKNOWN,
          eventResult: { source: 'webhook', kind: 'unmapped' },
          paymentSession: {
            provider: 'paypal',
            paymentStatus: 'processing' as never,
          },
        },
        deps: createDeps({
          recordUnknownWebhookEvent: async () => {
            throw new Error('audit insert failed');
          },
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
        }) as never,
      }),
    /audit insert failed/
  );

  assert.equal(checkoutHandled, false);
  assert.equal(renewalHandled, false);
  assert.equal(canceledHandled, false);
  assert.equal(updatedHandled, false);
});
