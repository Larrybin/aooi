import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BillingRuntimeSettings,
  PaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';

import {
  cancelSubscriptionUseCase,
  readCancelableSubscriptionPageUseCase,
} from './member-billing.actions';

const BILLING_SETTINGS: BillingRuntimeSettings = {
  locale: '',
  defaultLocale: '',
  selectPaymentEnabled: false,
  defaultPaymentProvider: 'stripe',
  stripeEnabled: true,
  stripePaymentMethods: '',
  creemEnabled: false,
  creemEnvironment: 'sandbox',
  creemProductIds: '',
  paypalEnabled: false,
  paypalEnvironment: 'sandbox',
};

const PAYMENT_BINDINGS: PaymentRuntimeBindings = {
  stripePublishableKey: '',
  stripeSecretKey: '',
  stripeSigningSecret: '',
  creemApiKey: '',
  creemSigningSecret: '',
  paypalClientId: '',
  paypalClientSecret: '',
  paypalWebhookId: '',
};

test('readCancelableSubscriptionPageUseCase 返回 not_found / forbidden / missing_subscription_target', async () => {
  const notFound = await readCancelableSubscriptionPageUseCase(
    {
      subscriptionNo: 'sub_1',
      actorUserId: 'user_1',
    },
    {
      findSubscriptionBySubscriptionNo: async () => undefined,
      getPaymentService: async () => ({
        getProvider: () => undefined,
      }),
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      readPaymentRuntimeBindings: async () => PAYMENT_BINDINGS,
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
      getPaymentService: async () => ({
        getProvider: () => undefined,
      }),
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      readPaymentRuntimeBindings: async () => PAYMENT_BINDINGS,
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
      getPaymentService: async () => ({
        getProvider: () => undefined,
      }),
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      readPaymentRuntimeBindings: async () => PAYMENT_BINDINGS,
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
      getPaymentService: async () => ({
        getProvider: () => undefined,
      }),
      readBillingRuntimeSettingsCached: async () => ({
        ...BILLING_SETTINGS,
        stripeEnabled: false,
      }),
      readPaymentRuntimeBindings: async () => PAYMENT_BINDINGS,
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
      getPaymentService: async () => ({
        getProvider: () => ({
          cancelSubscription: async () => ({ ok: true }),
        }),
      }),
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      readPaymentRuntimeBindings: async () => PAYMENT_BINDINGS,
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
      getPaymentService: async () => {
        throw new Error('stripe_signing_secret is required in production');
      },
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      readPaymentRuntimeBindings: async () => PAYMENT_BINDINGS,
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
      getPaymentService: async () => ({
        getProvider: () => ({
          cancelSubscription: async () => ({ ok: true }),
        }),
      }),
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      readPaymentRuntimeBindings: async () => PAYMENT_BINDINGS,
      updateSubscriptionBySubscriptionNo: async () => ({}),
    }
  );

  assert.deepEqual(result, { status: 'invalid_status' });
});
