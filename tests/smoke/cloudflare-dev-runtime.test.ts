import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWranglerDevArgs } from '../../scripts/lib/cloudflare-dev-runtime.mjs';

test('buildWranglerDevArgs 会注入独立 persist 目录且保留现有 wrangler dev 参数顺序', () => {
  const args = buildWranglerDevArgs({
    wranglerConfigPath: '/tmp/public-web.toml',
    port: 8788,
    inspectorPort: 19229,
    name: 'roller-rabbit-public-web',
    persistTo: '/tmp/state/public-web',
  });

  assert.deepEqual(args, [
    'exec',
    'wrangler',
    'dev',
    '--config',
    '/tmp/public-web.toml',
    '--name',
    'roller-rabbit-public-web',
    '--persist-to',
    '/tmp/state/public-web',
    '--local',
    '--port',
    '8788',
    '--inspector-port',
    '19229',
    '--show-interactive-dev-session=false',
  ]);
});

test('buildWranglerDevArgs 在未传 persistTo 时不回退到额外参数', () => {
  const args = buildWranglerDevArgs({
    wranglerConfigPath: '/tmp/public-web.toml',
    port: 8788,
    inspectorPort: 19229,
    name: 'roller-rabbit-public-web',
  });

  assert.equal(args.includes('--persist-to'), false);
});
