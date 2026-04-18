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
  getServerWorkerMetadata,
} from '../../src/shared/config/cloudflare-worker-splits';
import { readOpenNextGeneratedModules } from '../../scripts/sync-open-next-generated-types.mjs';

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

test('共享 worker helper 不允许顶层静态 import OpenNext 构建产物', async () => {
  const helperPaths = [
    'cloudflare/workers/create-server-worker.ts',
    'cloudflare/workers/router-forwarding.ts',
    'cloudflare/workers/stateful-limiters.ts',
  ];

  for (const relativePath of helperPaths) {
    const source = await fs.readFile(path.join(rootDir, relativePath), 'utf8');

    assert.doesNotMatch(
      source,
      /^\s*import\s.+from\s+['"][^'"]*\.open-next\//m,
      `${relativePath} 不应顶层静态 import .open-next 构建产物`
    );
  }
});

test('server worker helper 仅在运行时懒加载 OpenNext request context', async () => {
  const source = await fs.readFile(
    path.join(rootDir, 'cloudflare/workers/create-server-worker.ts'),
    'utf8'
  );

  assert.doesNotMatch(
    source,
    /^\s*import\s.+cloudflare\/init\.js['"]/m,
    'create-server-worker 不应顶层静态 import OpenNext init'
  );
  assert.match(
    source,
    /import\(\s*['"]\.\.\/\.\.\/\.open-next\/cloudflare\/init\.js['"]\s*\)/,
    'create-server-worker 应在 fetch 边界懒加载 OpenNext init'
  );
});

test('build tsconfig 覆盖 Cloudflare worker 与声明文件输入', async () => {
  const tsconfig = JSON.parse(
    await fs.readFile(path.join(rootDir, 'tsconfig.json'), 'utf8')
  ) as {
    include?: string[];
  };
  const includes = tsconfig.include || [];

  assert.ok(includes.includes('src/**/*.d.ts'));
  assert.ok(includes.includes('cloudflare/**/*.ts'));
});

test('router 依赖的 OpenNext 模块声明文件存在并被 build tsconfig 覆盖', async () => {
  const tsconfig = JSON.parse(
    await fs.readFile(path.join(rootDir, 'tsconfig.json'), 'utf8')
  ) as {
    include?: string[];
  };
  const declaredModules = await readOpenNextGeneratedModules();
  const declaredModulePaths = new Set(
    declaredModules.map(({ moduleSpecifier }) => moduleSpecifier)
  );

  assert.ok((tsconfig.include || []).includes('src/**/*.d.ts'));
  assert.ok(
    declaredModulePaths.has('../../.open-next/cloudflare/images.js'),
    '缺少 router images 声明'
  );
  assert.ok(
    declaredModulePaths.has('../../.open-next/cloudflare/init.js'),
    '缺少 router init 声明'
  );
  assert.ok(
    declaredModulePaths.has('../../.open-next/middleware/handler.mjs'),
    '缺少 middleware handler 声明'
  );
  const serverHandlerPaths = new Set([
    '../../.open-next/server-functions/default/handler.mjs',
    ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => {
      const metadata = getServerWorkerMetadata(target);
      return `../../${path
        .join(path.dirname(metadata.bundleEntryRelativePath), 'handler.mjs')
        .replaceAll(path.sep, '/')}`;
    }),
  ]);

  for (const handlerPath of serverHandlerPaths) {
    assert.ok(
      declaredModulePaths.has(handlerPath),
      `缺少 ${handlerPath} 声明`
    );
  }
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
