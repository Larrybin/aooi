import assert from 'node:assert/strict';
import test from 'node:test';

import { getInternalErrorMeta } from '@/shared/lib/errors';

import {
  resolvePaymentHealth,
  throwPaymentCapabilityNotFound,
} from './payment-capability';

test('resolvePaymentHealth 是显式 snapshot 纯函数，none 返回 disabled', () => {
  const health = resolvePaymentHealth({
    capability: 'none',
    settings: {},
    bindings: {},
  });

  assert.deepEqual(health, {
    capability: 'none',
    status: 'disabled',
    provider: null,
    missing: [],
  });
});

test('resolvePaymentHealth 对缺失 secrets 返回 misconfigured', () => {
  const health = resolvePaymentHealth({
    capability: 'stripe',
    settings: {},
    bindings: {
      stripePublishableKey: '',
      stripeSecretKey: 'sk',
      stripeSigningSecret: '',
    },
  });

  assert.equal(health.status, 'misconfigured');
  assert.deepEqual(health.missing, [
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SIGNING_SECRET',
  ]);
});

test('throwPaymentCapabilityNotFound 内部 reason 可区分但不暴露为可枚举字段', () => {
  try {
    throwPaymentCapabilityNotFound('capability_disabled');
  } catch (error) {
    assert.deepEqual(getInternalErrorMeta(error), {
      reason: 'capability_disabled',
    });
    assert.equal(
      Object.prototype.propertyIsEnumerable.call(
        error as object,
        'internalMeta'
      ),
      false
    );
  }
});
