import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAssetSettingValue } from './general';

test('normalizeAssetSettingValue: 允许清空值', () => {
  assert.deepEqual(normalizeAssetSettingValue('   ', 'Logo'), {
    ok: true,
    value: '',
  });
});

test('normalizeAssetSettingValue: 允许 public 路径', () => {
  assert.deepEqual(normalizeAssetSettingValue('/branding/logo.png', 'Logo'), {
    ok: true,
    value: '/branding/logo.png',
  });
});

test('normalizeAssetSettingValue: 允许绝对 http/https URL', () => {
  assert.deepEqual(
    normalizeAssetSettingValue('https://cdn.example.com/logo.png', 'Logo'),
    {
      ok: true,
      value: 'https://cdn.example.com/logo.png',
    }
  );
});

test('normalizeAssetSettingValue: 拒绝非法值', () => {
  const result = normalizeAssetSettingValue('logo.png', 'Logo');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /valid absolute URL or a public path/);
  }
});
