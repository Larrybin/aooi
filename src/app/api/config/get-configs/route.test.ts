import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGetConfigsLogic } from './route-logic';

test('config/get-configs 默认读取 cached public-config', async () => {
  const handler = buildGetConfigsLogic({
    resolveConfigConsistencyMode: () => 'cached',
    getPublicConfigsCached: async () => ({ general_ai_enabled: 'true' }),
    getPublicConfigsFresh: async () => ({ general_ai_enabled: 'false' }),
  });

  const response = await handler(
    new Request('http://localhost/api/config/get-configs')
  );
  const body = (await response.json()) as {
    data: { general_ai_enabled: string };
  };

  assert.equal(response.status, 200);
  assert.equal(body.data.general_ai_enabled, 'true');
});

test('config/get-configs 在 fresh 模式下读取 fresh public-config', async () => {
  const handler = buildGetConfigsLogic({
    resolveConfigConsistencyMode: () => 'fresh',
    getPublicConfigsCached: async () => ({ general_ai_enabled: 'true' }),
    getPublicConfigsFresh: async () => ({ general_ai_enabled: 'false' }),
  });

  const response = await handler(
    new Request('http://localhost/api/config/get-configs', {
      headers: {
        'x-aooi-config-consistency': 'fresh',
      },
    })
  );
  const body = (await response.json()) as {
    data: { general_ai_enabled: string };
  };

  assert.equal(response.status, 200);
  assert.equal(body.data.general_ai_enabled, 'false');
});
