import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PaymentEventType,
  PaymentStatus,
  WebhookPayloadError,
} from '@/domains/billing/domain/payment';
import {
  assertSuccessfulPaymentSessionContract,
  mapCreemEventTypeToCanonical,
  mapPayPalEventTypeToCanonical,
  mapStripeEventTypeToCanonical,
} from '@/infra/adapters/payment/provider-contract';

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

test('payment providers: Stripe 事件映射保持 canonical 契约', () => {
  assert.deepEqual(
    [
      mapStripeEventTypeToCanonical('checkout.session.completed'),
      mapStripeEventTypeToCanonical('invoice.payment_succeeded'),
      mapStripeEventTypeToCanonical('invoice.payment_failed'),
      mapStripeEventTypeToCanonical('customer.subscription.updated'),
      mapStripeEventTypeToCanonical('customer.subscription.deleted'),
    ],
    [
      PaymentEventType.CHECKOUT_SUCCESS,
      PaymentEventType.PAYMENT_SUCCESS,
      PaymentEventType.PAYMENT_FAILED,
      PaymentEventType.SUBSCRIBE_UPDATED,
      PaymentEventType.SUBSCRIBE_CANCELED,
    ]
  );
});

test('payment providers: Creem 事件映射保持 canonical 契约', () => {
  assert.deepEqual(
    [
      mapCreemEventTypeToCanonical('checkout.completed'),
      mapCreemEventTypeToCanonical('subscription.paid'),
      mapCreemEventTypeToCanonical('subscription.update'),
      mapCreemEventTypeToCanonical('subscription.canceled'),
    ],
    [
      PaymentEventType.CHECKOUT_SUCCESS,
      PaymentEventType.PAYMENT_SUCCESS,
      PaymentEventType.SUBSCRIBE_UPDATED,
      PaymentEventType.SUBSCRIBE_CANCELED,
    ]
  );
});

test('payment providers: PayPal 事件映射保持 canonical 契约', () => {
  assert.deepEqual(
    [
      mapPayPalEventTypeToCanonical('CHECKOUT.ORDER.APPROVED'),
      mapPayPalEventTypeToCanonical('PAYMENT.CAPTURE.COMPLETED'),
      mapPayPalEventTypeToCanonical('PAYMENT.CAPTURE.DENIED'),
      mapPayPalEventTypeToCanonical('BILLING.SUBSCRIPTION.UPDATED'),
      mapPayPalEventTypeToCanonical('BILLING.SUBSCRIPTION.CANCELLED'),
    ],
    [
      PaymentEventType.CHECKOUT_SUCCESS,
      PaymentEventType.PAYMENT_SUCCESS,
      PaymentEventType.PAYMENT_FAILED,
      PaymentEventType.SUBSCRIBE_UPDATED,
      PaymentEventType.SUBSCRIBE_CANCELED,
    ]
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
