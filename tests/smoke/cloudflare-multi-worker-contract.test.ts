import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import {
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  CLOUDFLARE_ROUTER_WORKER_NAME,
  CLOUDFLARE_SERVER_WORKERS,
  CLOUDFLARE_SERVICE_BINDINGS,
  CLOUDFLARE_SPLIT_WORKER_TARGETS,
} from '../../src/shared/config/cloudflare-worker-splits';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('router worker 不直接 import server handler', async () => {
  const routerSource = await fs.readFile(
    path.join(rootDir, 'cloudflare/workers/router.ts'),
    'utf8'
  );

  assert.ok(!routerSource.includes('server-functions/auth/handler.mjs'));
  assert.ok(!routerSource.includes('server-functions/payment/handler.mjs'));
  assert.ok(!routerSource.includes('server-functions/chat/handler.mjs'));
  assert.ok(!routerSource.includes('server-functions/admin/handler.mjs'));
  assert.ok(!routerSource.includes('server-functions/member/handler.mjs'));
});

test('server workers 不包含 middleware 或分发逻辑', async () => {
  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    const source = await fs.readFile(
      path.join(rootDir, `cloudflare/workers/server-${target}.ts`),
      'utf8'
    );

    assert.match(source, /createServerWorker/);
    assert.ok(!source.includes('middlewareHandler'));
    assert.ok(!source.includes('resolveWorkerTarget'));
    assert.ok(!source.includes('handleImageRequest'));
  }
});

test('server worker 公共入口会把字符串 env 绑定同步到 process.env', async () => {
  const source = await fs.readFile(
    path.join(rootDir, 'cloudflare/workers/create-server-worker.ts'),
    'utf8'
  );

  assert.match(source, /syncWorkerStringBindingsToProcessEnv/);
  assert.match(source, /process\.env\[key\] = value/);
});

test('router wrangler services 与 split manifest 一致', async () => {
  const wranglerConfig = await fs.readFile(
    path.join(rootDir, 'wrangler.cloudflare.toml'),
    'utf8'
  );

  assert.match(
    wranglerConfig,
    new RegExp(`service = "${CLOUDFLARE_ROUTER_WORKER_NAME}"`)
  );

  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    assert.match(
      wranglerConfig,
      new RegExp(`binding = "${CLOUDFLARE_SERVICE_BINDINGS[target]}"`)
    );
    assert.match(
      wranglerConfig,
      new RegExp(`service = "${CLOUDFLARE_SERVER_WORKERS[target]}"`)
    );
  }
});

test('split manifest 覆盖 canonical split 服务绑定', async () => {
  const wranglerConfig = await fs.readFile(
    path.join(rootDir, 'wrangler.cloudflare.toml'),
    'utf8'
  );

  for (const target of CLOUDFLARE_SPLIT_WORKER_TARGETS) {
    assert.match(
      wranglerConfig,
      new RegExp(`binding = "${CLOUDFLARE_SERVICE_BINDINGS[target]}"`)
    );
  }
});

test('tracked wrangler templates 不允许提交真实 localConnectionString', async () => {
  const configPaths = [
    path.join(rootDir, 'wrangler.cloudflare.toml'),
    ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) =>
      path.join(
        rootDir,
        `cloudflare/wrangler.server-${target}.toml`
      )
    ),
  ];

  for (const configPath of configPaths) {
    const source = await fs.readFile(configPath, 'utf8');
    assert.match(source, /^\s*localConnectionString\s*=\s*""/m);
  }
});

test('Cloudflare 本地 harness 不再直接调用 createPreviewManager', async () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const harnessPaths = [
    'scripts/run-cf-local-smoke.mjs',
    'scripts/run-cf-admin-settings-smoke.mjs',
    'scripts/run-cf-auth-spike.mjs',
    'scripts/run-cf-oauth-spike.mjs',
    'scripts/run-local-auth-spike.mjs',
  ];

  for (const relativePath of harnessPaths) {
    const source = await fs.readFile(path.join(rootDir, relativePath), 'utf8');
    assert.ok(
      !source.includes('createPreviewManager('),
      `${relativePath} 不应直接调用 createPreviewManager`
    );
    assert.ok(
      source.includes('startCloudflareLocalDevTopology'),
      `${relativePath} 应通过共享 topology 启动 Cloudflare 本地运行时`
    );
  }
});
