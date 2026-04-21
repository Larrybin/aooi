import assert from 'node:assert/strict';
import test from 'node:test';

import { withApi } from '@/shared/lib/api/route';

import {
  buildPaymentCallbackGetHandler,
  buildPaymentCallbackPostAction,
} from './route-logic';

function createApiContextStub(options?: {
  orderNo?: string;
  requireUserError?: Error;
  user?: { id: string; email?: string | null };
}) {
  return () =>
    ({
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      parseQuery: () => {
        if (options?.orderNo) {
          return { order_no: options.orderNo };
        }
        throw new Error('invalid request params');
      },
      parseJson: async () => ({ order_no: options?.orderNo ?? 'order_1' }),
      requireUser: async () => {
        if (options?.requireUserError) {
          throw options.requireUserError;
        }
        return (options?.user ?? { id: 'user_1', email: 'user@example.com' }) as never;
      },
    }) as never;
}

function assertRedirectDigest(error: unknown, expectedPath: string) {
  assert.ok(error instanceof Error);
  const digest = 'digest' in error ? String(error.digest) : error.message;
  assert.match(digest, /NEXT_REDIRECT/);
  assert.match(
    digest,
    new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
}

test('payment/callback GET 未登录时回退到 /pricing', async () => {
  const handler = buildPaymentCallbackGetHandler({
    createApiContext: createApiContextStub({
      orderNo: 'order_1',
      requireUserError: new Error('no auth, please sign in'),
    }),
    resolveRedirectQuery: async () => {
      throw new Error('should not resolve redirect query');
    },
    resolvePricingFallbackUrl: async () => 'https://app.example.com/pricing',
  });

  await assert.rejects(
    () => handler(new Request('http://localhost/api/payment/callback?order_no=order_1')),
    (error: unknown) => {
      assertRedirectDigest(error, 'https://app.example.com/pricing');
      return true;
    }
  );
});

test('payment/callback GET 缺少或非法 order_no 时回退到 /pricing', async () => {
  const handler = buildPaymentCallbackGetHandler({
    createApiContext: createApiContextStub(),
    resolveRedirectQuery: async () => {
      throw new Error('should not resolve redirect query');
    },
    resolvePricingFallbackUrl: async () => 'https://app.example.com/pricing',
  });

  await assert.rejects(
    () => handler(new Request('http://localhost/api/payment/callback')),
    (error: unknown) => {
      assertRedirectDigest(error, 'https://app.example.com/pricing');
      return true;
    }
  );
});

test('payment/callback GET 在 fallback helper 返回相对 /pricing 时仍重定向', async () => {
  const handler = buildPaymentCallbackGetHandler({
    createApiContext: createApiContextStub({
      orderNo: 'order_1',
      requireUserError: new Error('no auth, please sign in'),
    }),
    resolveRedirectQuery: async () => {
      throw new Error('should not resolve redirect query');
    },
    resolvePricingFallbackUrl: async () => '/pricing',
  });

  await assert.rejects(
    () => handler(new Request('http://localhost/api/payment/callback?order_no=order_1')),
    (error: unknown) => {
      assertRedirectDigest(error, '/pricing');
      return true;
    }
  );
});

test('payment/callback GET 正常时跳到 application 解析的 redirect url', async () => {
  const handler = buildPaymentCallbackGetHandler({
    createApiContext: createApiContextStub({
      orderNo: 'order_1',
      user: { id: 'user_1', email: 'user@example.com' },
    }),
    resolveRedirectQuery: async () => 'https://app.example.com/return?order_no=order_1',
    resolvePricingFallbackUrl: async () => {
      throw new Error('should not resolve pricing fallback');
    },
  });

  await assert.rejects(
    () => handler(new Request('http://localhost/api/payment/callback?order_no=order_1')),
    (error: unknown) => {
      assertRedirectDigest(error, 'https://app.example.com/return?order_no=order_1');
      return true;
    }
  );
});

test('payment/callback POST 正常返回 { orderNo, redirectUrl } 契约', async () => {
  const handler = withApi(
    buildPaymentCallbackPostAction({
      createApiContext: createApiContextStub({
        orderNo: 'order_1',
        user: { id: 'user_1', email: 'user@example.com' },
      }),
      confirmUseCase: async () => ({
        orderNo: 'order_1',
        redirectUrl: 'https://app.example.com/return',
      }),
      resolveMode: () => 'cached',
    })
  );

  const response = await handler(
    new Request('http://localhost/api/payment/callback', { method: 'POST' })
  );

  const body = (await response.json()) as {
    code: number;
    data: { orderNo: string; redirectUrl: string };
  };

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.orderNo, 'order_1');
  assert.equal(body.data.redirectUrl, 'https://app.example.com/return');
});
