import assert from 'node:assert/strict';
import test from 'node:test';

import { readPublicConfigsByMode } from './public-config-projection';

test('readPublicConfigsByMode 在 cached 模式下对 DB 失败保持 fail-open', async () => {
  const configs = await readPublicConfigsByMode('cached', {
    readRuntimeSettingsSafeImpl: async () => ({
      configs: {
        general_ai_enabled: 'true',
        private_secret: 'ignored',
      },
      error: new Error('db unavailable'),
    }),
  });

  assert.deepEqual(configs, {
    general_ai_enabled: 'true',
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
      hiddenSiteIdentity: 'Hidden Site Identity',
      hiddenStoragePublicBaseUrl: 'https://cdn.example.com/assets/',
      general_ai_enabled: 'true',
      stripe_secret_key: 'hidden',
    }),
  });

  assert.deepEqual(configs, {
    general_ai_enabled: 'true',
  });
});
