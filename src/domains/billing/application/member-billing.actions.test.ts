import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cancelSubscriptionUseCase,
  readCancelableSubscriptionPageUseCase,
} from './member-billing.actions';

test('readCancelableSubscriptionPageUseCase 返回 not_found / forbidden / missing_subscription_target', async () => {
  const notFound = await readCancelableSubscriptionPageUseCase(
    {
      subscriptionNo: 'sub_1',
      actorUserId: 'user_1',
    },
    {
      findSubscriptionBySubscriptionNo: async () => undefined,
      getPaymentServiceWithConfigs: async () => ({
        getProvider: () => undefined,
      }),
      readRuntimeSettingsCached: async () => ({}),
    }
  );
  assert.deepEqual(notFound, { status: 'not_found' });

  const forbidden = await readCancelableSubscriptionPageUseCase(
    {
      subscriptionNo: 'sub_1',
      actorUserId: 'user_1',
    },
    {
      findSubscriptionBySubscriptionNo: async () =>
        ({
          subscriptionNo: 'sub_1',
          userId: 'other_user',
        }) as never,
      getPaymentServiceWithConfigs: async () => ({
        getProvider: () => undefined,
      }),
      readRuntimeSettingsCached: async () => ({}),
    }
  );
  assert.deepEqual(forbidden, { status: 'forbidden' });

  const missingTarget = await readCancelableSubscriptionPageUseCase(
    {
      subscriptionNo: 'sub_1',
      actorUserId: 'user_1',
    },
    {
      findSubscriptionBySubscriptionNo: async () =>
        ({
          subscriptionNo: 'sub_1',
          userId: 'user_1',
          paymentProvider: null,
          subscriptionId: null,
        }) as never,
      getPaymentServiceWithConfigs: async () => ({
        getProvider: () => undefined,
      }),
      readRuntimeSettingsCached: async () => ({}),
    }
  );
  assert.deepEqual(missingTarget, { status: 'missing_subscription_target' });
});

test('readCancelableSubscriptionPageUseCase 对 provider 不可用返回 provider_not_found，并且不吞 invalid_status', async () => {
  const providerNotFound = await readCancelableSubscriptionPageUseCase(
    {
      subscriptionNo: 'sub_1',
      actorUserId: 'user_1',
    },
    {
      findSubscriptionBySubscriptionNo: async () =>
        ({
          subscriptionNo: 'sub_1',
          userId: 'user_1',
          paymentProvider: 'stripe',
          subscriptionId: 'provider_sub_1',
          status: 'canceled',
        }) as never,
      getPaymentServiceWithConfigs: async () => ({
        getProvider: () => undefined,
      }),
      readRuntimeSettingsCached: async () => ({ stripe_enabled: 'false' }),
    }
  );

  assert.deepEqual(providerNotFound, { status: 'provider_not_found' });

  const okForInvalidStatus = await readCancelableSubscriptionPageUseCase(
    {
      subscriptionNo: 'sub_1',
      actorUserId: 'user_1',
    },
    {
      findSubscriptionBySubscriptionNo: async () =>
        ({
          subscriptionNo: 'sub_1',
          userId: 'user_1',
          paymentProvider: 'stripe',
          subscriptionId: 'provider_sub_1',
          status: 'canceled',
          amount: 1200,
          currency: 'usd',
          intervalCount: 1,
          interval: 'month',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        }) as never,
      getPaymentServiceWithConfigs: async () => ({
        getProvider: () => ({
          cancelSubscription: async () => ({ ok: true }),
        }),
      }),
      readRuntimeSettingsCached: async () => ({ stripe_enabled: 'true' }),
    }
  );

  assert.equal(okForInvalidStatus.status, 'ok');
});

test('readCancelableSubscriptionPageUseCase 在 payment service 构建失败时返回 provider_not_found', async () => {
  const result = await readCancelableSubscriptionPageUseCase(
    {
      subscriptionNo: 'sub_1',
      actorUserId: 'user_1',
    },
    {
      findSubscriptionBySubscriptionNo: async () =>
        ({
          subscriptionNo: 'sub_1',
          userId: 'user_1',
          paymentProvider: 'stripe',
          subscriptionId: 'provider_sub_1',
          status: 'active',
          amount: 1200,
          currency: 'usd',
          intervalCount: 1,
          interval: 'month',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        }) as never,
      getPaymentServiceWithConfigs: async () => {
        throw new Error('stripe_signing_secret is required in production');
      },
      readRuntimeSettingsCached: async () => ({ stripe_enabled: 'true' }),
    }
  );

  assert.deepEqual(result, { status: 'provider_not_found' });
});

test('cancelSubscriptionUseCase 仅在提交期返回 invalid_status', async () => {
  const result = await cancelSubscriptionUseCase(
    {
      subscriptionNo: 'sub_1',
      actorUserId: 'user_1',
    },
    {
      findSubscriptionBySubscriptionNo: async () =>
        ({
          subscriptionNo: 'sub_1',
          userId: 'user_1',
          subscriptionId: 'provider_sub_1',
          paymentProvider: 'stripe',
          status: 'canceled',
        }) as never,
      getPaymentServiceWithConfigs: async () => ({
        getProvider: () => ({
          cancelSubscription: async () => ({ ok: true }),
        }),
      }),
      readRuntimeSettingsCached: async () => ({ stripe_enabled: 'true' }),
      updateSubscriptionBySubscriptionNo: async () => ({}),
    }
  );

  assert.deepEqual(result, { status: 'invalid_status' });
});
