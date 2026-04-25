import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDefaultSettingsSnapshot,
  mergeMissingDefaultSettings,
} from './bootstrap';
import { ALL_SETTINGS } from './registry';

test('createDefaultSettingsSnapshot 为所有已注册 setting 提供默认值快照', () => {
  const snapshot = createDefaultSettingsSnapshot();

  assert.equal(
    Object.keys(snapshot).length,
    ALL_SETTINGS.length,
    'default snapshot must cover every registered setting'
  );
  assert.equal(snapshot.general_ai_enabled, 'false');
  assert.equal(snapshot.email_auth_enabled, 'true');
  assert.equal(snapshot.stripe_payment_methods, '["card"]');
  assert.equal(snapshot.resend_sender_email, '');
});

test('createDefaultSettingsSnapshot 可对外部 settings 列表复用', () => {
  const snapshot = createDefaultSettingsSnapshot([
    {
      name: 'flag',
      title: 'Flag',
      type: 'switch',
      moduleId: 'core_shell',
      tab: 'general',
      group: {
        id: 'general_ui',
        titleKey: 'groups.general_ui',
      },
      value: true,
      visibility: 'public',
    },
  ]);

  assert.deepEqual(snapshot, {
    flag: 'true',
  });
});

test('mergeMissingDefaultSettings 只补缺失默认值，不覆盖已有 runtime settings', () => {
  const missing = mergeMissingDefaultSettings({
    current: {
      general_ai_enabled: 'true',
      custom_runtime_setting: 'keep',
    },
    defaults: {
      general_ai_enabled: 'false',
      resend_sender_email: '',
    },
  });

  assert.deepEqual(missing, {
    resend_sender_email: '',
  });
});
