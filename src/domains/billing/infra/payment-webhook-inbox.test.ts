import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PaymentEventType,
  SubscriptionCycleType,
} from '@/domains/billing/domain/payment';

import {
  deserializePaymentWebhookCanonicalEvent,
  serializePaymentWebhookCanonicalEvent,
} from './payment-webhook-canonical-event';

test('deserializePaymentWebhookCanonicalEvent 会恢复嵌套时间字段为 Date', () => {
  const serialized = serializePaymentWebhookCanonicalEvent({
    eventType: PaymentEventType.PAYMENT_SUCCESS,
    eventResult: {
      providerEventId: 'evt_1',
    },
    paymentSession: {
      provider: 'creem',
      paymentInfo: {
        paymentAmount: 100,
        paymentCurrency: 'USD',
        subscriptionCycleType: SubscriptionCycleType.RENEWAL,
        paidAt: new Date('2026-04-17T10:00:00.000Z'),
      },
      subscriptionId: 'sub_1',
      subscriptionInfo: {
        subscriptionId: 'sub_1',
        currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        canceledAt: new Date('2026-04-15T08:00:00.000Z'),
        canceledEndAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    },
  });

  const event = deserializePaymentWebhookCanonicalEvent(serialized);

  assert.ok(event.paymentSession.paymentInfo?.paidAt instanceof Date);
  assert.ok(
    event.paymentSession.subscriptionInfo?.currentPeriodStart instanceof Date
  );
  assert.ok(
    event.paymentSession.subscriptionInfo?.currentPeriodEnd instanceof Date
  );
  assert.ok(event.paymentSession.subscriptionInfo?.canceledAt instanceof Date);
  assert.ok(
    event.paymentSession.subscriptionInfo?.canceledEndAt instanceof Date
  );
  assert.equal(
    event.paymentSession.paymentInfo?.paidAt?.toISOString(),
    '2026-04-17T10:00:00.000Z'
  );
});

test('deserializePaymentWebhookCanonicalEvent 对空 canonical event 抛错', () => {
  assert.throws(
    () => deserializePaymentWebhookCanonicalEvent(''),
    /payment webhook canonical event missing/
  );
});
