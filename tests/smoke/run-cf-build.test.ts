import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOpenNextBuildArgs } from '../../scripts/run-cf-build.mjs';

test('cf:build 对 OpenNext 固定跳过根 wrangler config 交互检查', () => {
  assert.deepEqual(buildOpenNextBuildArgs(), [
    'exec',
    'opennextjs-cloudflare',
    'build',
    '--skipWranglerConfigCheck',
  ]);
});
