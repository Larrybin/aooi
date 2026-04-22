import assert from 'node:assert/strict';
import test from 'node:test';

import { WebhookConfigError, WebhookVerificationError } from '@/domains/billing/domain/payment';
import { StripeTransport } from '@/infra/adapters/payment/stripe-transport';

test('Stripe transport: constructWebhookEvent 委托 Stripe client 并返回事件', () => {
  const event = { id: 'evt_123', type: 'checkout.session.completed' };
  const transport = new StripeTransport(
    {
      secretKey: 'sk_test',
      publishableKey: 'pk_test',
      signingSecret: 'whsec_test',
    },
    {
      client: {
        customers: {} as never,
        checkout: {} as never,
        invoices: {} as never,
        billingPortal: {} as never,
        subscriptions: {} as never,
        webhooks: {
          constructEvent: (
            rawBody: string,
            signature: string,
            secret: string
          ) => {
            assert.equal(rawBody, '{"ok":true}');
            assert.equal(signature, 'sig_123');
            assert.equal(secret, 'whsec_test');
            return event as never;
          },
        } as never,
      } as never,
    }
  );

  assert.deepEqual(
    transport.constructWebhookEvent({
      rawBody: '{"ok":true}',
      signature: 'sig_123',
    }),
    event
  );
});

test('Stripe transport: constructWebhookEvent 缺少 signingSecret 时抛出配置错误', () => {
  const transport = new StripeTransport(
    {
      secretKey: 'sk_test',
      publishableKey: 'pk_test',
    },
    {
      client: {
        customers: {} as never,
        checkout: {} as never,
        invoices: {} as never,
        billingPortal: {} as never,
        subscriptions: {} as never,
        webhooks: {
          constructEvent: () => {
            throw new Error('should not reach');
          },
        } as never,
      } as never,
    }
  );

  assert.throws(
    () =>
      transport.constructWebhookEvent({
        rawBody: '{"ok":true}',
        signature: 'sig_123',
      }),
    WebhookConfigError
  );
});

test('Stripe transport: constructWebhookEvent 签名非法时抛出验签错误', () => {
  const transport = new StripeTransport(
    {
      secretKey: 'sk_test',
      publishableKey: 'pk_test',
      signingSecret: 'whsec_test',
    },
    {
      client: {
        customers: {} as never,
        checkout: {} as never,
        invoices: {} as never,
        billingPortal: {} as never,
        subscriptions: {} as never,
        webhooks: {
          constructEvent: () => {
            throw new Error('invalid');
          },
        } as never,
      } as never,
    }
  );

  assert.throws(
    () =>
      transport.constructWebhookEvent({
        rawBody: '{"ok":true}',
        signature: 'sig_123',
      }),
    WebhookVerificationError
  );
});
