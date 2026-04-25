import assert from 'node:assert/strict';
import test from 'node:test';

import { getSettingsModuleContractRows } from './module-contract';

test('getSettingsModuleContractRows: 返回配置页签对应的模块契约行', () => {
  const generalRows = getSettingsModuleContractRows('general');
  const paymentRows = getSettingsModuleContractRows('payment');

  assert.ok(generalRows.length > 0);
  assert.ok(generalRows.every((row) => typeof row.moduleId === 'string'));
  assert.ok(Array.isArray(paymentRows));
});
