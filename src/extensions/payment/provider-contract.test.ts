import assert from 'node:assert/strict';
import test from 'node:test';

import { PaymentEventType, PaymentStatus, WebhookPayloadError } from '.';
import {
  assertSuccessfulPaymentSessionContract,
  mapCreemEventTypeToCanonical,
  mapPayPalEventTypeToCanonical,
  mapStripeEventTypeToCanonical,
} from './provider-contract';

test('payment providers: 三家 provider 的未知事件映射均返回 UNKNOWN', () => {
  assert.equal(
    mapStripeEventTypeToCanonical('customer.subscription.resumed'),
    PaymentEventType.UNKNOWN
  );
  assert.equal(
    mapCreemEventTypeToCanonical('subscription.expired'),
    PaymentEventType.UNKNOWN
  );
  assert.equal(
    mapPayPalEventTypeToCanonical('BILLING.SUBSCRIPTION.RE-ACTIVATED'),
    PaymentEventType.UNKNOWN
  );
});

test('payment providers: SUCCESS 事件缺失 paymentInfo 时严格报错', () => {
  assert.throws(
    () =>
      assertSuccessfulPaymentSessionContract({
        provider: 'stripe',
        paymentStatus: PaymentStatus.SUCCESS,
      }),
    (error: unknown) =>
      error instanceof WebhookPayloadError &&
      error.message === 'missing payment info for successful event'
  );
});

test('payment providers: SUCCESS 事件缺失 paymentAmount 时严格报错', () => {
  assert.throws(
    () =>
      assertSuccessfulPaymentSessionContract({
        provider: 'creem',
        paymentStatus: PaymentStatus.SUCCESS,
        paymentInfo: {
          paymentCurrency: 'USD',
        },
      }),
    (error: unknown) =>
      error instanceof WebhookPayloadError &&
      error.message === 'missing payment amount for successful event'
  );
});

test('payment providers: SUCCESS 事件缺失 paymentCurrency 时严格报错', () => {
  assert.throws(
    () =>
      assertSuccessfulPaymentSessionContract({
        provider: 'paypal',
        paymentStatus: PaymentStatus.SUCCESS,
        paymentInfo: {
          paymentAmount: 100,
          paymentCurrency: '',
        },
      }),
    (error: unknown) =>
      error instanceof WebhookPayloadError &&
      error.message === 'missing payment currency for successful event'
  );
});
