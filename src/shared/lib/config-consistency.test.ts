import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONFIG_CONSISTENCY_FRESH_VALUE,
  CONFIG_CONSISTENCY_HEADER,
  resolveConfigConsistencyMode,
} from './config-consistency';

test('resolveConfigConsistencyMode 在本地 smoke 且显式 fresh header 时返回 fresh', () => {
  const request = new Request('http://localhost/api/config/get-configs', {
    headers: {
      [CONFIG_CONSISTENCY_HEADER]: CONFIG_CONSISTENCY_FRESH_VALUE,
    },
  });

  assert.equal(
    resolveConfigConsistencyMode(request, {
      CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
    }),
    'fresh'
  );
});

test('resolveConfigConsistencyMode 在非本地环境忽略 fresh header', () => {
  const request = new Request('http://localhost/api/config/get-configs', {
    headers: {
      [CONFIG_CONSISTENCY_HEADER]: CONFIG_CONSISTENCY_FRESH_VALUE,
    },
  });

  assert.equal(resolveConfigConsistencyMode(request, {}), 'cached');
});

test('resolveConfigConsistencyMode 在未显式声明时默认返回 cached', () => {
  const request = new Request('http://localhost/api/config/get-configs');

  assert.equal(
    resolveConfigConsistencyMode(request, {
      CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
    }),
    'cached'
  );
});
