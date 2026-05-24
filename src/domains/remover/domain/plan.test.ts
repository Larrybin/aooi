import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRemoverPlanLimits } from './plan';
import type { RemoverActor } from './types';

test('resolveRemoverPlanLimits uses signed-in actor grant entitlements', () => {
  const actor = {
    kind: 'user',
    userId: 'user_1',
    productId: 'free',
    productAccess: {
      actor: {
        kind: 'user',
        userId: 'user_1',
      },
      siteKey: 'ai-remover',
      productKey: 'ai-remover',
      productId: 'free',
      environment: 'preview',
      source: 'grant',
      planKey: 'Free',
      packageKey: 'free',
      entitlements: {
        monthly_removals: 50,
        monthly_high_res_downloads: 25,
        max_upload_mb: 20,
        priority_queue: true,
      },
      entitlementGrantIds: ['grant_1'],
    },
  } satisfies RemoverActor;

  const limits = resolveRemoverPlanLimits(actor);

  assert.equal(limits.productId, 'free');
  assert.equal(limits.processingLimit, 50);
  assert.equal(limits.processingWindow, 'month');
  assert.equal(limits.highResDownloads, 25);
  assert.equal(limits.highResDownloadWindow, 'month');
  assert.equal(limits.maxUploadMb, 20);
  assert.equal(limits.priorityQueue, true);
});

test('resolveRemoverPlanLimits keeps paid pricing-derived limits unchanged through product access', () => {
  const limits = resolveRemoverPlanLimits({
    kind: 'user',
    userId: 'user_1',
    productId: 'pro-monthly',
    productAccess: {
      actor: {
        kind: 'user',
        userId: 'user_1',
      },
      siteKey: 'ai-remover',
      productKey: 'ai-remover',
      productId: 'pro-monthly',
      environment: 'preview',
      source: 'subscription',
      planKey: 'Pro',
      packageKey: 'pro-monthly',
      entitlements: {
        monthly_removals: 500,
        monthly_high_res_downloads: 300,
        advanced_mode: true,
        max_upload_mb: 20,
        retention_days: 30,
      },
      entitlementGrantIds: [],
    },
  });

  assert.deepEqual(limits, {
    productId: 'pro-monthly',
    processingLimit: 500,
    processingWindow: 'month',
    highResDownloads: 300,
    highResDownloadWindow: 'month',
    maxUploadMb: 20,
    retentionDays: 30,
    lowResDownload: true,
    advancedMode: true,
    priorityQueue: false,
  });
});

test('resolveRemoverPlanLimits keeps anonymous guest limits unchanged', () => {
  const limits = resolveRemoverPlanLimits({
    kind: 'anonymous',
    anonymousSessionId: 'anon_1',
  });

  assert.equal(limits.productId, 'guest');
  assert.equal(limits.processingLimit, 2);
  assert.equal(limits.processingWindow, 'day');
  assert.equal(limits.highResDownloads, 0);
  assert.equal(limits.maxUploadMb, 5);
});
