import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBackgroundRemoverPlanLimits } from './plan';

test('resolveBackgroundRemoverPlanLimits uses guest daily defaults', () => {
  const limits = resolveBackgroundRemoverPlanLimits({
    kind: 'anonymous',
    anonymousSessionId: 'anon_1',
  });

  assert.deepEqual(limits, {
    productId: 'guest',
    processingLimit: 2,
    processingWindow: 'day',
    maxUploadMb: 10,
    retentionDays: 1,
  });
});

test('resolveBackgroundRemoverPlanLimits uses monthly paid entitlements', () => {
  const limits = resolveBackgroundRemoverPlanLimits({
    kind: 'user',
    userId: 'user_1',
    productAccess: {
      actor: { kind: 'user', userId: 'user_1' },
      siteKey: 'background-remover',
      productKey: 'background-remover',
      productId: 'pro-monthly',
      environment: 'local',
      source: 'subscription',
      planKey: 'Pro',
      packageKey: 'pro-monthly',
      entitlements: {
        monthly_removals: 500,
        max_upload_mb: 20,
        retention_days: 30,
      },
      entitlementGrantIds: [],
    },
  });

  assert.equal(limits.productId, 'pro-monthly');
  assert.equal(limits.processingLimit, 500);
  assert.equal(limits.processingWindow, 'month');
  assert.equal(limits.maxUploadMb, 20);
  assert.equal(limits.retentionDays, 30);
});
