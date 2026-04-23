import assert from 'node:assert/strict';
import test from 'node:test';

import { readServiceConfigsByMode } from '@/infra/adapters/config-read-mode';

test('readServiceConfigsByMode 默认读取 cached 配置', async () => {
  const calls: string[] = [];

  const configs = await readServiceConfigsByMode(undefined, {
    readSettingsCachedImpl: async () => {
      calls.push('cached');
      return { general_ai_enabled: 'cached' };
    },
    readSettingsFreshImpl: async () => {
      calls.push('fresh');
      return { general_ai_enabled: 'fresh' };
    },
  });

  assert.deepEqual(configs, { general_ai_enabled: 'cached' });
  assert.deepEqual(calls, ['cached']);
});

test('readServiceConfigsByMode 在 fresh 模式下读取 fresh 配置', async () => {
  const calls: string[] = [];

  const configs = await readServiceConfigsByMode('fresh', {
    readSettingsCachedImpl: async () => {
      calls.push('cached');
      return { general_ai_enabled: 'cached' };
    },
    readSettingsFreshImpl: async () => {
      calls.push('fresh');
      return { general_ai_enabled: 'fresh' };
    },
  });

  assert.deepEqual(configs, { general_ai_enabled: 'fresh' });
  assert.deepEqual(calls, ['fresh']);
});
