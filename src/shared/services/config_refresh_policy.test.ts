import assert from 'node:assert/strict';
import test from 'node:test';

import { readServiceConfigsByMode } from './config-read-mode';

test('readServiceConfigsByMode 默认读取 cached 配置', async () => {
  const calls: string[] = [];

  const configs = await readServiceConfigsByMode(undefined, {
    readRuntimeSettingsCachedImpl: async () => {
      calls.push('cached');
      return { app_name: 'cached' };
    },
    readRuntimeSettingsFreshImpl: async () => {
      calls.push('fresh');
      return { app_name: 'fresh' };
    },
  });

  assert.deepEqual(configs, { app_name: 'cached' });
  assert.deepEqual(calls, ['cached']);
});

test('readServiceConfigsByMode 在 fresh 模式下读取 fresh 配置', async () => {
  const calls: string[] = [];

  const configs = await readServiceConfigsByMode('fresh', {
    readRuntimeSettingsCachedImpl: async () => {
      calls.push('cached');
      return { app_name: 'cached' };
    },
    readRuntimeSettingsFreshImpl: async () => {
      calls.push('fresh');
      return { app_name: 'fresh' };
    },
  });

  assert.deepEqual(configs, { app_name: 'fresh' });
  assert.deepEqual(calls, ['fresh']);
});
