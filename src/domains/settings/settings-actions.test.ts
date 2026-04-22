import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeRegisteredSettingValues } from './settings-submit-merge';

test('mergeRegisteredSettingValues: 忽略未注册 key 并应用归一化覆盖', () => {
  const nextConfigs = mergeRegisteredSettingValues({
    initialConfigs: {
      app_name: 'Old Name',
      general_social_links: '[]',
    },
    values: {
      app_name: '  Demo App  ',
      general_social_links: '  ',
      injected_key: 'should-be-ignored',
    },
    normalizedOverrides: {
      app_name: 'Demo App',
      general_social_links: '',
    },
  });

  assert.deepEqual(nextConfigs, {
    app_name: 'Demo App',
    general_social_links: '',
  });
});
