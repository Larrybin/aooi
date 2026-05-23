import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import type { SitePricing } from '@/shared/types/blocks/pricing';

import { validateProductEntitlements } from './schema';

test('AI Remover pricing entitlements match the registered product schema', async () => {
  const pricing = JSON.parse(
    await readFile('sites/ai-remover/pricing.json', 'utf8')
  ) as SitePricing;

  for (const item of pricing.pricing.items ?? []) {
    validateProductEntitlements({
      productKey: 'ai-remover',
      entitlements: item.entitlements ?? {},
      source: `pricing ${item.product_id}`,
    });
  }
});

test('validateProductEntitlements rejects unknown product keys and fields', () => {
  assert.throws(
    () =>
      validateProductEntitlements({
        productKey: 'missing-product',
        entitlements: {},
        source: 'test',
      }),
    /no entitlement schema registered/u
  );
  assert.throws(
    () =>
      validateProductEntitlements({
        productKey: 'ai-remover',
        entitlements: {
          typo_monthly_removal: 10,
        },
        source: 'test',
      }),
    /unknown entitlement typo_monthly_removal/u
  );
});
