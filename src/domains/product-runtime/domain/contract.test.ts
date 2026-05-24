import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defineProductRuntimeContract,
  getProductRuntimeRequiredKeys,
} from './contract';

test('defineProductRuntimeContract preserves product runtime requirements', () => {
  const contract = defineProductRuntimeContract({
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    requiredWorkers: {
      'public-web': true,
      chat: false,
    },
    requiredBindings: {
      workersAi: true,
    },
    requiredVars: {
      storagePublicBaseUrl: true,
    },
    requiredSecrets: {
      removerCleanup: true,
    },
  });

  assert.deepEqual(getProductRuntimeRequiredKeys(contract), {
    workers: ['public-web'],
    bindings: ['workersAi'],
    vars: ['storagePublicBaseUrl'],
    secrets: ['removerCleanup'],
  });
});

test('defineProductRuntimeContract rejects missing identity', () => {
  assert.throws(
    () =>
      defineProductRuntimeContract({
        siteKey: '',
        productKey: 'ai-remover',
      }),
    /siteKey is required/
  );
  assert.throws(
    () =>
      defineProductRuntimeContract({
        siteKey: 'ai-remover',
        productKey: '',
      }),
    /productKey is required/
  );
});
