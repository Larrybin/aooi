import assert from 'node:assert/strict';
import test from 'node:test';

import { PUBLIC_SETTING_NAMES } from './public-setting-names';

test('PUBLIC_SETTING_NAMES: 包含品牌资源相关配置', () => {
  assert.equal(PUBLIC_SETTING_NAMES.includes('app_logo'), true);
  assert.equal(PUBLIC_SETTING_NAMES.includes('app_favicon'), true);
  assert.equal(PUBLIC_SETTING_NAMES.includes('app_og_image'), true);
});
