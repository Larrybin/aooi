import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits';
import {
  buildRouterDeployConfigContent,
  buildVersionDeploySpecs,
  determineDeployMode,
  parseWranglerJsonPayload,
  resolvePostDeploySmokeUrl,
} from '../../scripts/run-cf-multi-deploy.mjs';

const { CLOUDFLARE_ALL_SERVER_WORKER_TARGETS, CLOUDFLARE_VERSION_ID_VARS } =
  cloudflareWorkerSplits;

test('buildRouterDeployConfigContent 将 router 入口、assets 与 version ids 改写为部署态配置', () => {
  const template = `
name = "roller-rabbit"
main = "cloudflare/workers/router.ts"

[assets]
directory = ".open-next/assets"

[vars]
PUBLIC_WEB_WORKER_VERSION_ID = ""
AUTH_WORKER_VERSION_ID = ""
PAYMENT_WORKER_VERSION_ID = ""
MEMBER_WORKER_VERSION_ID = ""
CHAT_WORKER_VERSION_ID = ""
ADMIN_WORKER_VERSION_ID = ""
`;

  const versionIds = Object.fromEntries(
    CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target, index) => [
      target,
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ])
  );

  const config = buildRouterDeployConfigContent(template, versionIds);

  assert.match(
    config,
    new RegExp(
      `main = "${escapeRegExp(path.relative(path.resolve(process.cwd(), '.tmp'), path.resolve(process.cwd(), 'cloudflare/workers/router.ts')))}"`
    )
  );
  assert.match(
    config,
    new RegExp(
      `directory = "${escapeRegExp(path.relative(path.resolve(process.cwd(), '.tmp'), path.resolve(process.cwd(), '.open-next/assets')))}"`
    )
  );

  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    const versionVar = CLOUDFLARE_VERSION_ID_VARS[target];
    assert.match(config, new RegExp(`${versionVar} = "${versionIds[target]}"`));
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('resolvePostDeploySmokeUrl 在未显式传 env 时回退到 router wrangler 的 NEXT_PUBLIC_APP_URL', () => {
  const smokeUrl = resolvePostDeploySmokeUrl({
    processEnv: {},
    routerConfigContent: `
[vars]
NEXT_PUBLIC_APP_URL = "https://mamamiya.pdfreprinting.net/"
`,
  });

  assert.equal(smokeUrl, 'https://mamamiya.pdfreprinting.net/');
});

test('determineDeployMode 在 router 或任一 server 缺 deployment 时进入 bootstrap', () => {
  const servers = Object.fromEntries(
    CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [target, `v-${target}`])
  );

  assert.equal(
    determineDeployMode({
      router: null,
      servers,
    }),
    'bootstrap'
  );

  assert.equal(
    determineDeployMode({
      router: 'v-router',
      servers: {
        ...servers,
        member: null,
      },
    }),
    'bootstrap'
  );

  assert.equal(
    determineDeployMode({
      router: 'v-router',
      servers,
    }),
    'steady-state'
  );
});

test('buildVersionDeploySpecs 生成 bootstrap 与 steady-state 的部署顺序', () => {
  assert.deepEqual(buildVersionDeploySpecs(null, 'v-next'), ['v-next@100%']);
  assert.deepEqual(buildVersionDeploySpecs('v-current', 'v-next'), [
    'v-next@100%',
    'v-current@0%',
  ]);
});

test('parseWranglerJsonPayload 能从 wrangler 前置日志中提取 JSON', () => {
  const payload = parseWranglerJsonPayload(`
Proxy environment variables detected. We'll use your proxy for fetch requests.
[
  {
    "name": "BETTER_AUTH_SECRET",
    "type": "secret_text"
  }
]
`);

  assert.deepEqual(payload, [
    {
      name: 'BETTER_AUTH_SECRET',
      type: 'secret_text',
    },
  ]);
});
