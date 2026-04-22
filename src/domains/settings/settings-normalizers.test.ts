import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSettingOverrides } from './settings-normalizers';

test('normalizeSettingOverrides: stripe_payment_methods 非法 JSON 回退 card', () => {
  const result = normalizeSettingOverrides({
    stripe_payment_methods: 'not-json',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.stripe_payment_methods, '["card"]');
  }
});

test('normalizeSettingOverrides: general_social_links 空值允许通过', () => {
  const result = normalizeSettingOverrides({
    general_social_links: '   ',
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      general_social_links: '',
    },
  });
});
