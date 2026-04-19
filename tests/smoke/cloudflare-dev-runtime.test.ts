import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWranglerMultiConfigDevArgs } from '../../scripts/lib/cloudflare-dev-runtime.mjs';

test('buildWranglerMultiConfigDevArgs 会按固定顺序串联多配置并复用单一 persist 目录', () => {
  const args = buildWranglerMultiConfigDevArgs({
    wranglerConfigPaths: [
      '/tmp/router.toml',
      '/tmp/public-web.toml',
      '/tmp/auth.toml',
    ],
    port: 8787,
    persistTo: '/tmp/state/local-topology',
  });

  assert.deepEqual(args, [
    'exec',
    'wrangler',
    'dev',
    '--config',
    '/tmp/router.toml',
    '--config',
    '/tmp/public-web.toml',
    '--config',
    '/tmp/auth.toml',
    '--persist-to',
    '/tmp/state/local-topology',
    '--local',
    '--port',
    '8787',
    '--show-interactive-dev-session=false',
  ]);
});

test('buildWranglerMultiConfigDevArgs 在未传 persistTo 时不追加该参数', () => {
  const args = buildWranglerMultiConfigDevArgs({
    wranglerConfigPaths: ['/tmp/router.toml', '/tmp/public-web.toml'],
    port: 8787,
  });

  assert.equal(args.includes('--persist-to'), false);
});
