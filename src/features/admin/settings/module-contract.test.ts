import assert from 'node:assert/strict';
import test from 'node:test';

import { getSettingsModuleContractViewModel } from './module-contract';

test('getSettingsModuleContractViewModel: general tab 映射到 core shell', () => {
  const viewModel = getSettingsModuleContractViewModel('general');

  assert.ok(viewModel);
  assert.equal(viewModel.moduleId, 'core_shell');
  assert.equal(viewModel.tier, 'mainline');
  assert.equal(viewModel.verification, 'verified');
  assert.equal(viewModel.isSupporting, false);
});

test('getSettingsModuleContractViewModel: auth/payment/ai tab 返回所属模块信息', () => {
  assert.equal(getSettingsModuleContractViewModel('auth')?.moduleId, 'auth');
  assert.equal(
    getSettingsModuleContractViewModel('payment')?.moduleId,
    'billing'
  );
  assert.equal(getSettingsModuleContractViewModel('ai')?.moduleId, 'ai');
});

test('getSettingsModuleContractViewModel: supporting tab 会返回主模块和辅助说明', () => {
  const viewModel = getSettingsModuleContractViewModel('email');

  assert.ok(viewModel);
  assert.equal(viewModel.moduleId, 'auth');
  assert.equal(viewModel.isSupporting, true);
  assert.deepEqual(viewModel.supportingModuleTitles, [
    'Auth',
    'Customer Service',
  ]);
  assert.match(viewModel.guideHref, /modules\/auth\.md$/);
});
