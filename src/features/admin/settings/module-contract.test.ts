import assert from 'node:assert/strict';
import test from 'node:test';

import { getSettingsModuleContractRows } from './module-contract';

test('getSettingsModuleContractRows: general tab 返回 core shell owned 行', () => {
  const rows = getSettingsModuleContractRows('general');

  assert.deepEqual(rows, [
    {
      moduleId: 'core_shell',
      title: 'Core Shell',
      relationship: 'owned',
      tier: 'mainline',
      verification: 'verified',
      guideHref:
        'https://github.com/Larrybin/aooi/blob/main/docs/guides/module-contract.md#core-shell',
    },
  ]);
});

test('getSettingsModuleContractRows: auth/payment/ai tab 返回所属模块信息', () => {
  assert.equal(getSettingsModuleContractRows('auth')[0]?.moduleId, 'auth');
  assert.equal(getSettingsModuleContractRows('payment')[0]?.moduleId, 'billing');
  assert.equal(getSettingsModuleContractRows('ai')[0]?.moduleId, 'ai');
});

test('getSettingsModuleContractRows: content tab 返回 docs/blog owned 行', () => {
  const rows = getSettingsModuleContractRows('content');

  assert.deepEqual(
    rows.map((row) => ({
      moduleId: row.moduleId,
      relationship: row.relationship,
      tier: row.tier,
      verification: row.verification,
    })),
    [
      {
        moduleId: 'docs',
        relationship: 'owned',
        tier: 'optional',
        verification: 'partial',
      },
      {
        moduleId: 'blog',
        relationship: 'owned',
        tier: 'optional',
        verification: 'partial',
      },
    ]
  );
});

test('getSettingsModuleContractRows: email tab 返回 supporting 行且按优先级排序', () => {
  const rows = getSettingsModuleContractRows('email');

  assert.deepEqual(
    rows.map((row) => ({
      moduleId: row.moduleId,
      relationship: row.relationship,
      tier: row.tier,
    })),
    [
      {
        moduleId: 'auth',
        relationship: 'supporting',
        tier: 'mainline',
      },
      {
        moduleId: 'customer_service',
        relationship: 'supporting',
        tier: 'optional',
      },
    ]
  );
  assert.match(rows[0]?.guideHref || '', /modules\/auth\.md$/);
  assert.match(rows[1]?.guideHref || '', /modules\/growth-support\.md$/);
});
