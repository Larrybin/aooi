import assert from 'node:assert/strict';
import test from 'node:test';

import {
  confirmPaymentCallbackUseCase,
  resolvePaymentCallbackPricingFallbackUrl,
  resolvePaymentCallbackRedirectQuery,
} from './payment-callback';

function createLog() {
  return {
    debug() {
      return undefined;
    },
    info() {
      return undefined;
    },
    warn() {
      return undefined;
    },
    errorCalls: [] as Array<{ message: string; meta?: unknown }>,
    error(message: string, meta?: unknown) {
      this.errorCalls.push({ message, meta });
    },
  };
}

test('resolvePaymentCallbackRedirectQuery 对 not_found/forbidden 回退到 pricing', async () => {
  const log = createLog();

  const notFound = await resolvePaymentCallbackRedirectQuery(
    {
      orderNo: 'order_1',
      actorUserId: 'user_1',
      log,
    },
    {
      readRuntimeSettingsCached: async () =>
        ({ app_url: 'https://app.example.com' }) as never,
      getServerPublicEnvConfigs: () =>
        ({ app_url: 'https://app.example.com' }) as never,
      findOrderByOrderNo: async () => undefined as never,
    }
  );
  assert.equal(notFound, 'https://app.example.com/pricing');

  const forbidden = await resolvePaymentCallbackRedirectQuery(
    {
      orderNo: 'order_1',
      actorUserId: 'user_1',
      log,
    },
    {
      readRuntimeSettingsCached: async () =>
        ({ app_url: 'https://app.example.com' }) as never,
      getServerPublicEnvConfigs: () =>
        ({ app_url: 'https://app.example.com' }) as never,
      findOrderByOrderNo: async () =>
        ({
          orderNo: 'order_1',
          userId: 'other_user',
          paymentType: 'one-time',
        }) as never,
    }
  );
  assert.equal(forbidden, 'https://app.example.com/pricing');
  assert.equal(log.errorCalls.length >= 2, true);
});

test('resolvePaymentCallbackRedirectQuery 成功返回带 order_no 的 redirectUrl', async () => {
  const result = await resolvePaymentCallbackRedirectQuery(
    {
      orderNo: 'order_1',
      actorUserId: 'user_1',
      log: createLog(),
    },
    {
      readRuntimeSettingsCached: async () =>
        ({ app_url: 'https://app.example.com' }) as never,
      getServerPublicEnvConfigs: () =>
        ({ app_url: 'https://app.example.com' }) as never,
      findOrderByOrderNo: async () =>
        ({
          orderNo: 'order_1',
          userId: 'user_1',
          paymentType: 'subscription',
          callbackUrl: 'https://app.example.com/return',
        }) as never,
    }
  );

  assert.equal(result, 'https://app.example.com/return?order_no=order_1');
});

test('resolvePaymentCallbackPricingFallbackUrl 返回绝对 pricing fallback url', async () => {
  const result = await resolvePaymentCallbackPricingFallbackUrl({
    readRuntimeSettingsCached: async () =>
      ({ app_url: 'https://app.example.com' }) as never,
    getServerPublicEnvConfigs: () =>
      ({ app_url: 'https://fallback.example.com' }) as never,
  });

  assert.equal(result, 'https://app.example.com/pricing');
});

test('confirmPaymentCallbackUseCase 覆盖 invalid order 与成功确认支付', async () => {
  await assert.rejects(
    () =>
      confirmPaymentCallbackUseCase(
        {
          orderNo: 'order_1',
          actorUserId: 'user_1',
          actorUserEmail: 'user@example.com',
          log: createLog(),
        },
        {
          readRuntimeSettingsCached: async () =>
            ({ app_url: 'https://app.example.com' }) as never,
          readRuntimeSettingsFresh: async () =>
            ({ app_url: 'https://app.example.com' }) as never,
          getServerPublicEnvConfigs: () =>
            ({ app_url: 'https://app.example.com' }) as never,
          findOrderByOrderNo: async () =>
            ({
              orderNo: 'order_1',
              userId: 'user_1',
              paymentType: 'subscription',
            }) as never,
          getPaymentServiceWithConfigs: async () => {
            throw new Error('should not call payment service');
          },
          handleCheckoutSuccess: async () => {
            throw new Error('should not handle success');
          },
        }
      ),
    /invalid order/
  );

  let handled = 0;

  const result = await confirmPaymentCallbackUseCase(
    {
      orderNo: 'order_1',
      actorUserId: 'user_1',
      actorUserEmail: 'user@example.com',
      log: createLog(),
    },
    {
      readRuntimeSettingsCached: async () =>
        ({ app_url: 'https://app.example.com' }) as never,
      readRuntimeSettingsFresh: async () =>
        ({ app_url: 'https://app.example.com' }) as never,
      getServerPublicEnvConfigs: () =>
        ({ app_url: 'https://app.example.com' }) as never,
      findOrderByOrderNo: async () =>
        ({
          orderNo: 'order_1',
          userId: 'user_1',
          paymentType: 'subscription',
          callbackUrl: 'https://app.example.com/return',
          paymentSessionId: 'session_1',
          paymentProvider: 'stripe',
        }) as never,
      getPaymentServiceWithConfigs: async () =>
        ({
          getPaymentSession: async () =>
            ({
              provider: 'stripe',
              paymentStatus: 'paid',
            }) as never,
        }) as never,
      handleCheckoutSuccess: async () => {
        handled += 1;
        return undefined as never;
      },
    }
  );

  assert.equal(result.orderNo, 'order_1');
  assert.equal(result.redirectUrl, 'https://app.example.com/return');
  assert.equal(handled, 1);
});
