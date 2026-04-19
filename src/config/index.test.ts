import assert from 'node:assert/strict';
import test from 'node:test';

import { envConfigs } from './index';

test('envConfigs 仍可作为纯公共配置对象直接导入', () => {
  assert.equal(typeof envConfigs.app_url, 'string');
  assert.equal(typeof envConfigs.app_name, 'string');
  assert.equal(typeof envConfigs.app_logo, 'string');
  assert.equal(typeof envConfigs.app_favicon, 'string');
  assert.equal(typeof envConfigs.app_og_image, 'string');
  assert.equal(typeof envConfigs.theme, 'string');
  assert.equal(typeof envConfigs.locale, 'string');
});
