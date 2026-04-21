import assert from 'node:assert/strict';
import test from 'node:test';

import { isCloudflareLocalWorkersDevRuntime } from './runtime-mode';

test('isCloudflareLocalWorkersDevRuntime 仅在本地 Cloudflare topology 标记开启时返回 true', () => {
  assert.equal(isCloudflareLocalWorkersDevRuntime({}), false);
  assert.equal(
    isCloudflareLocalWorkersDevRuntime({
      CF_LOCAL_SMOKE_WORKERS_DEV: 'false',
    }),
    false
  );
  assert.equal(
    isCloudflareLocalWorkersDevRuntime({
      CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
    }),
    true
  );
});
