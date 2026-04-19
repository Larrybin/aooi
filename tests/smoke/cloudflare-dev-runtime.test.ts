import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWranglerMultiConfigDevArgs } from '../../scripts/lib/cloudflare-dev-runtime.mjs';
import {
  DNS_RESULT_ORDER_IPV4_FIRST,
  withIpv4FirstNodeOptions,
} from '../../scripts/lib/node-process-env.mjs';

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

test('withIpv4FirstNodeOptions 会为 wrangler 子进程补齐 IPv4 优先解析', () => {
  const env = withIpv4FirstNodeOptions({
    FOO: 'bar',
  });

  assert.equal(env.FOO, 'bar');
  assert.equal(env.NODE_OPTIONS, DNS_RESULT_ORDER_IPV4_FIRST);
});

test('withIpv4FirstNodeOptions 会保留现有 NODE_OPTIONS 并避免重复注入', () => {
  const env = withIpv4FirstNodeOptions({
    NODE_OPTIONS: `${DNS_RESULT_ORDER_IPV4_FIRST} --max-old-space-size=4096`,
  });

  assert.equal(
    env.NODE_OPTIONS,
    `${DNS_RESULT_ORDER_IPV4_FIRST} --max-old-space-size=4096`
  );
});
