import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAdminSettingsModuleContractChecks,
  validateAdminSettingsModuleContractSnapshot,
} from '../../scripts/run-admin-settings-module-contract-smoke.mjs';

test('getAdminSettingsModuleContractChecks: 覆盖五个代表性 settings tab', () => {
  const checks = getAdminSettingsModuleContractChecks('http://127.0.0.1:3000');

  assert.deepEqual(
    checks.map((check) => check.name),
    ['general', 'auth', 'payment', 'ai', 'content', 'email']
  );
});

test('validateAdminSettingsModuleContractSnapshot: 校验普通 tab 快照', () => {
  const [generalCheck] = getAdminSettingsModuleContractChecks(
    'http://127.0.0.1:3000'
  );

  assert.doesNotThrow(() =>
    validateAdminSettingsModuleContractSnapshot(generalCheck, {
      visible: true,
      rows: generalCheck.expectedRows,
    })
  );
});

test('validateAdminSettingsModuleContractSnapshot: 校验多模块 content tab 快照', () => {
  const contentCheck = getAdminSettingsModuleContractChecks(
    'http://127.0.0.1:3000'
  ).find((check) => check.name === 'content');

  assert(contentCheck);
  assert.doesNotThrow(() =>
    validateAdminSettingsModuleContractSnapshot(contentCheck, {
      visible: true,
      rows: contentCheck.expectedRows,
    })
  );
});

test('validateAdminSettingsModuleContractSnapshot: 校验 supporting tab 快照', () => {
  const emailCheck = getAdminSettingsModuleContractChecks(
    'http://127.0.0.1:3000'
  ).find((check) => check.name === 'email');

  assert(emailCheck);
  assert.doesNotThrow(() =>
    validateAdminSettingsModuleContractSnapshot(emailCheck, {
      visible: true,
      rows: emailCheck.expectedRows,
    })
  );
});
