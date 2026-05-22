import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRemoverPlanLimits } from './plan';
import type { RemoverActor } from './types';

test('resolveRemoverPlanLimits uses signed-in actor grant entitlements', () => {
  const actor = {
    kind: 'user',
    userId: 'user_1',
    productId: 'free',
    entitlements: {
      monthly_removals: 50,
      monthly_high_res_downloads: 25,
      max_upload_mb: 20,
      priority_queue: true,
    },
    entitlementGrantIds: ['grant_1'],
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
