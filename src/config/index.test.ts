import assert from 'node:assert/strict';
import test from 'node:test';

import { envConfigs } from './index';

test('envConfigs 仍可作为纯公共配置对象直接导入', () => {
  assert.equal(typeof envConfigs.theme, 'string');
  assert.equal(typeof envConfigs.locale, 'string');
});
