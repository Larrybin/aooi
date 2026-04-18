import assert from 'node:assert/strict';
import test from 'node:test';

import { WebhookConfigError, WebhookVerificationError } from '@/core/payment/domain';
import { UpstreamError } from '@/shared/lib/api/errors';
import { PayPalTransport } from '@/core/payment/providers/paypal-transport';

test('PayPal transport: request 会先取 token 并复用缓存', async () => {
  const calls: string[] = [];
  const authHeaders: string[] = [];
  const transport = new PayPalTransport(
    {
      clientId: 'client',
      clientSecret: 'secret',
    },
    {
      now: () => 1000,
      fetchJson: (async (url: string, init?: RequestInit) => {
        calls.push(url);
        if (url.endsWith('/v1/oauth2/token')) {
          return {
            access_token: 'token_123',
            expires_in: 3600,
          };
        }
        authHeaders.push(String((init?.headers as Record<string, string>).Authorization));
        return {
          id: 'order_123',
          status: 'COMPLETED',
        };
      }) as never,
    }
  );

  await transport.getOrder('order_123');
  await transport.getSubscription('sub_123');

  assert.equal(calls.filter((url) => url.endsWith('/v1/oauth2/token')).length, 1);
  assert.deepEqual(authHeaders, ['Bearer token_123', 'Bearer token_123']);
});

test('PayPal transport: request 失败时抛出 UpstreamError', async () => {
  const transport = new PayPalTransport(
    {
      clientId: 'client',
      clientSecret: 'secret',
    },
    {
      fetchJson: (async () => {
        throw new Error('boom');
      }) as never,
    }
  );

  await assert.rejects(() => transport.getOrder('order_123'), UpstreamError);
});

test('PayPal transport: verifyWebhookSignature 缺少 webhookId 时抛出配置错误', async () => {
  const transport = new PayPalTransport(
    {
      clientId: 'client',
      clientSecret: 'secret',
    },
    {
      fetchJson: (async () => {
        throw new Error('should not reach');
      }) as never,
    }
  );

  await assert.rejects(
    () =>
      transport.verifyWebhookSignature({
        headers: {},
        webhookEvent: {
          event_type: 'CHECKOUT.ORDER.COMPLETED',
        },
      }),
    WebhookConfigError
  );
});

test('PayPal transport: verifyWebhookSignature 非 SUCCESS 时抛出验签错误', async () => {
  const transport = new PayPalTransport(
    {
      clientId: 'client',
      clientSecret: 'secret',
      webhookId: 'wh_123',
    },
    {
      fetchJson: (async (url: string) => {
        if (url.endsWith('/v1/oauth2/token')) {
          return {
            access_token: 'token_123',
            expires_in: 3600,
          };
        }
        return {
          verification_status: 'FAILURE',
        };
      }) as never,
    }
  );

  await assert.rejects(
    () =>
      transport.verifyWebhookSignature({
        headers: {},
        webhookEvent: {
          event_type: 'CHECKOUT.ORDER.COMPLETED',
        },
      }),
    WebhookVerificationError
  );
});
