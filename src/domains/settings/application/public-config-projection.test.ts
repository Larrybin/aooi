import assert from 'node:assert/strict';
import test from 'node:test';

import { readPublicConfigsByMode } from './public-config-projection';

test('readPublicConfigsByMode 在 cached 模式下对 DB 失败保持 fail-open', async () => {
  const configs = await readPublicConfigsByMode('cached', {
    readRuntimeSettingsSafeImpl: async () => ({
      configs: {
        app_name: 'Fallback Name',
        storage_public_base_url: 'https://cdn.example.com/assets/',
        private_secret: 'ignored',
      },
      error: new Error('db unavailable'),
    }),
  });

  assert.deepEqual(configs, {
    app_name: 'Fallback Name',
    storage_public_base_url: 'https://cdn.example.com/assets/',
  });
});

test('readPublicConfigsByMode 在 fresh 模式下对 DB 失败保持 strict fail-fast', async () => {
  await assert.rejects(
    readPublicConfigsByMode('fresh', {
      readRuntimeSettingsFreshImpl: async () => {
        throw new Error('db unavailable');
      },
    }),
    /db unavailable/
  );
});

test('readPublicConfigsByMode 不会把非公开配置暴露到 public-config', async () => {
  const configs = await readPublicConfigsByMode('fresh', {
    readRuntimeSettingsFreshImpl: async () => ({
      app_name: 'Visible Name',
      general_ai_enabled: 'true',
      stripe_secret_key: 'hidden',
    }),
  });

  assert.deepEqual(configs, {
    app_name: 'Visible Name',
    general_ai_enabled: 'true',
  });
});
