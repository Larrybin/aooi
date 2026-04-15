import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { buildCloudflareWranglerConfig } from '../../scripts/create-cf-wrangler-config.mjs';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('buildCloudflareWranglerConfig 为 router 模板注入数据库、app url、deploy target 与 version vars', () => {
  const template = `
name = "roller-rabbit"
main = "cloudflare/workers/router.ts"

[assets]
directory = ".open-next/assets"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "id_123"
localConnectionString = ""

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "http://localhost:3000"
PUBLIC_WEB_WORKER_VERSION_ID = ""
AUTH_WORKER_VERSION_ID = ""
`;

  const outputPath = '/repo/.tmp/router/wrangler.cloudflare.deploy.toml';
  const config = buildCloudflareWranglerConfig({
    template,
    databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/aooi',
    appUrl: 'http://127.0.0.1:8787',
    deployTarget: 'cloudflare',
    devHost: '127.0.0.1',
    devUpstreamProtocol: 'http',
    templatePath: '/repo/wrangler.cloudflare.toml',
    outputPath,
    versionVars: {
      PUBLIC_WEB_WORKER_VERSION_ID: 'v-public-web',
      AUTH_WORKER_VERSION_ID: 'v-auth',
    },
  });

  assert.match(
    config,
    new RegExp(
      `main = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/cloudflare/workers/router.ts'))}"`
    )
  );
  assert.match(
    config,
    new RegExp(
      `directory = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/.open-next/assets'))}"`
    )
  );
  assert.match(
    config,
    /localConnectionString = "postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/aooi"/
  );
  assert.match(config, /NEXT_PUBLIC_APP_URL = "http:\/\/127\.0\.0\.1:8787"/);
  assert.match(config, /DEPLOY_TARGET = "cloudflare"/);
  assert.match(config, /PUBLIC_WEB_WORKER_VERSION_ID = "v-public-web"/);
  assert.match(config, /AUTH_WORKER_VERSION_ID = "v-auth"/);
  assert.match(config, /\[dev\]\nhost = "127\.0\.0\.1"\nupstream_protocol = "http"/);
});

test('buildCloudflareWranglerConfig 为 server 模板重写相对 main 与 assets 路径', () => {
  const template = `
main = "workers/server-public-web.ts"

[assets]
directory = "../.open-next/assets"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "id_123"
localConnectionString = ""

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
`;

  const outputPath = '/repo/.tmp/server/default.toml';
  const config = buildCloudflareWranglerConfig({
    template,
    templatePath: '/repo/cloudflare/wrangler.server-public-web.toml',
    outputPath,
  });

  assert.match(
    config,
    new RegExp(
      `main = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/cloudflare/workers/server-public-web.ts'))}"`
    )
  );
  assert.match(
    config,
    new RegExp(
      `directory = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/.open-next/assets'))}"`
    )
  );
  assert.match(config, /localConnectionString = ""/);
});

test('buildCloudflareWranglerConfig 会在已有 [dev] 段内覆盖 host 并补齐 upstream_protocol', () => {
  const template = `
name = "roller-rabbit"
main = "cloudflare/workers/router.ts"

[assets]
directory = ".open-next/assets"

[dev]
host = "example.com"

[vars]
NEXT_PUBLIC_APP_URL = "https://example.com"
`;

  const config = buildCloudflareWranglerConfig({
    template,
    devHost: 'localhost',
    devUpstreamProtocol: 'http',
    templatePath: '/repo/wrangler.cloudflare.toml',
    outputPath: '/repo/.tmp/router.toml',
  });

  assert.match(
    config,
    /\[dev\]\nhost = "localhost"\n(?:\n)?upstream_protocol = "http"\n/
  );
});
