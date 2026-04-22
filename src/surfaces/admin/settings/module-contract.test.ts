import assert from 'node:assert/strict';
import test from 'node:test';

import { getSettingsModuleContractRows } from './module-contract';

test('getSettingsModuleContractRows: 返回配置页签对应的模块契约行', () => {
  const rows = getSettingsModuleContractRows('payment');

  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => typeof row.moduleId === 'string'));
});
